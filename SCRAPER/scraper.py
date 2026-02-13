import time
import gspread
import re
import random
from google.oauth2.service_account import Credentials
from gspread.exceptions import SpreadsheetNotFound, WorksheetNotFound
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# --- Import for multiprocessing ---
import multiprocessing
from functools import partial

# --- Import geopy and phonenumbers libraries ---
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable
import phonenumbers
from phonenumbers import phonenumberutil

def get_country_for_location(location):
    """
    Uses the Nominatim geocoding API to reliably find the country name and 2-letter code.
    Returns: (str: country_name, str: country_code)
    """
    print(f"--- Determining country for '{location}'...")
    try:
        geolocator = Nominatim(user_agent="my_business_scraper_v1.3")
        location_data = geolocator.geocode(
            location, 
            addressdetails=True, 
            language="en", 
            timeout=10
        )
        
        if location_data and 'address' in location_data.raw and 'country' in location_data.raw['address']:
            country_name = location_data.raw['address']['country']
            country_code = location_data.raw['address']['country_code'].upper() # e.g., "in" -> "IN"
            print(f"--- Found country: {country_name} ({country_code}) ---")
            return country_name, country_code
        else:
            print(f"--- Could not find country for '{location}' via geopy. ---")
            return "Not specified", None
            
    except (GeocoderTimedOut, GeocoderUnavailable) as e:
        print(f"--- Geocoding service error: {e}. Defaulting to 'Not specified'. ---")
        return "Not specified", None
    except Exception as e:
        print(f"--- An unexpected error occurred in get_country_for_location: {e} ---")
        return "Not specified", None

def validate_and_get_mobile(phone_number_str, country_code):
    """
    Parses a phone number string and checks if it's a valid MOBILE number.
    Returns the E.164 formatted number (e.g., +919876543210) if it's mobile,
    otherwise returns None.
    """
    if not phone_number_str or not country_code:
        return None
        
    try:
        parsed_number = phonenumbers.parse(phone_number_str, country_code)
        
        if not phonenumbers.is_valid_number(parsed_number):
            return None
            
        number_type = phonenumbers.number_type(parsed_number)
        
        if number_type == phonenumbers.PhoneNumberType.MOBILE or \
           number_type == phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE:
            return phonenumbers.format_number(parsed_number, phonenumbers.PhoneNumberFormat.E164)
            
        return None
        
    except phonenumberutil.NumberParseException:
        return None
    except Exception as e:
        print(f"     └── ⛔ Error in phone validation: {e}")
        return None

def find_and_save_dynamically(keyword, location, user_country, user_country_code, worksheet, existing_keys):
    """
    Searches Google Maps, visits the business website to find an email,
    and saves valid, unique businesses that have a valid mobile number (email is optional).
    
    NOTE: This function opens and closes its own browser instance.
    """
    search_query = f"{keyword} in {location}, {user_country}".replace(" ", "+")
    url = f"https://www.google.com/maps/search/{search_query}" 

    service = Service(ChromeDriverManager().install())
    options = webdriver.ChromeOptions()
    options.add_argument('--log-level=3')
    options.add_argument('--ignore-certificate-errors')
    options.add_argument('--allow-running-insecure-content')
    options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
    options.add_argument('--start-maximized') # Start the browser maximized
    
    driver = None # Initialize driver to None
    try:
        driver = webdriver.Chrome(service=service, options=options)
        wait = WebDriverWait(driver, 15) 

        print(f"[{keyword}] Navigating to Google Maps for '{location}, {user_country}'...")
        driver.get(url)

        # --- Handle Consent Pop-up ---
        try:
            reject_button = WebDriverWait(driver, 5).until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Reject all')] | //button[contains(., 'Rechazar todo')]")))
            reject_button.click()
            print(f"[{keyword}] Consent pop-up handled.")
        except TimeoutException:
            print(f"[{keyword}] Consent pop-up did not appear.")

        # --- Scroll Through All Results ---
        business_card_selector = 'a.hfpxzc'
        scrollable_div = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'div[role="feed"]')))
        print(f"[{keyword}] Scrolling to load all results for '{location}'...")
        last_count = 0
        while True:
            driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", scrollable_div)
            time.sleep(random.uniform(2.0, 4.0)) 
            current_count = len(driver.find_elements(By.CSS_SELECTOR, business_card_selector))
            if current_count == last_count:
                print(f"[{keyword}] Reached the end of the results.")
                break
            last_count = current_count

        business_links = [elem.get_attribute('href') for elem in driver.find_elements(By.CSS_SELECTOR, business_card_selector)]
        print(f"[{keyword}] Found {len(business_links)} businesses in '{location}'. Starting scraping...")
        
        added_count = 0
        original_tab = driver.current_window_handle
        
        city = location
        country = user_country

        for i, link in enumerate(business_links):
            try:
                driver.switch_to.new_window('tab')
                driver.get(link)

                try: name = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'h1.DUwDvf, h1.fontHeadlineLarge'))).text
                except TimeoutException: name = "Name not found"
                try: website = driver.find_element(By.CSS_SELECTOR, 'a[data-item-id="authority"]').get_attribute('href')
                except NoSuchElementException: website = "No website"
                try:
                    address_container = driver.find_element(By.CSS_SELECTOR, 'button[data-item-id="address"]')
                    address = address_container.find_element(By.CSS_SELECTOR, 'div.Io6YTe').text
                except NoSuchElementException: 
                    address = "No address"
                try:
                    phone_container = driver.find_element(By.CSS_SELECTOR, 'button[data-item-id^="phone:tel:"]')
                    phone = phone_container.find_element(By.CSS_SELECTOR, 'div.Io6YTe').text
                except NoSuchElementException: phone = "No phone number"
                
                email = "No email found"
                if website != "No website":
                    try:
                        driver.get(website)
                        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                        time.sleep(random.uniform(2.0, 4.0)) 
                        mailto_links = driver.find_elements(By.CSS_SELECTOR, 'a[href^="mailto:"]')
                        if mailto_links:
                            email_href = mailto_links[0].get_attribute('href')
                            email = email_href.replace('mailto:', '', 1).split('?')[0] 
                        if email == "No email found":
                            page_source = driver.page_source
                            email_regex = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?!jpg|png|svg|jpeg|gif|webp)[a-zA-Z]{2,}'
                            matches = re.findall(email_regex, page_source, re.IGNORECASE)
                            if matches: email = matches[0] 
                    except Exception as web_e:
                        print(f"     [{keyword}] ⛔ Error scraping website {website}: {type(web_e).__name__}")
                
                mobile_number = validate_and_get_mobile(phone, user_country_code)
                print(f"[{keyword}][{i+1}/{len(business_links)}] Scraped: {name} | Mobile: {mobile_number or 'None'}")
                
                if not mobile_number:
                    print(f"     [{keyword}] 🟡 Skipping (Not a valid mobile number).")
                    driver.close()
                    driver.switch_to.window(original_tab)
                    continue

                item_key = (name, address)
                
                if item_key in existing_keys:
                    print(f"     [{keyword}] 🔵 Skipping (Duplicate already in sheet).")
                    driver.close()
                    driver.switch_to.window(original_tab)
                    continue
                
                row_to_add = [name, address, mobile_number, website, email, country, keyword, city]
                
                worksheet.append_row(row_to_add, value_input_option='USER_ENTERED')
                
                existing_keys.add(item_key) 
                
                added_count += 1
                print(f"     [{keyword}] ✅ Added to Google Sheet.")
                
                driver.close()
                driver.switch_to.window(original_tab)

                if i < len(business_links) - 1:
                    time.sleep(random.uniform(2.6, 5.6))

            except Exception as e:
                print(f"     [{keyword}] ⛔ An unexpected error occurred on this business: {e}")
                if len(driver.window_handles) > 1:
                    driver.close()
                driver.switch_to.window(original_tab)
                continue
        
        return added_count

    except TimeoutException:
        print(f"[{keyword}] ⛔ Could not find search results for '{location}'. Skipping.")
        return 0
    except Exception as e:
        print(f"[{keyword}] ⛔ An unexpected error occurred in find_and_save: {e}")
        return 0
    finally:
        if driver:
            driver.quit()


# --- Worker function for parallel processing ---
def process_keyword_task(user_keyword, locations_list):
    """
    This function is run by each parallel process.
    It handles ONE keyword and loops through ALL locations for it.
    """
    
    # --- THIS IS THE FIX ---
    # Add a random delay ("jitter") to prevent all processes from
    # authenticating at the exact same time.
    time.sleep(random.uniform(1.0, 5.0))
    # --- END OF FIX ---

    print(f"\n--- Process started for keyword: '{user_keyword}' ---")
    
    try:
        # --- Each process must authorize itself ---
        print(f"[{user_keyword}] Connecting to Google Sheets...")
        scope = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
        creds = Credentials.from_service_account_file("service_account.json", scopes=scope)
        client = gspread.authorize(creds)
        spreadsheet = client.open("scraper")
        
        # --- Get/Create worksheet ---
        worksheet = None
        all_worksheet_titles = [ws.title for ws in spreadsheet.worksheets()]
        for title in all_worksheet_titles:
            if title.lower() == user_keyword.lower():
                print(f"[{user_keyword}] Found existing worksheet: '{title}'")
                worksheet = spreadsheet.worksheet(title)
                break

        if worksheet is None:
            print(f"[{user_keyword}] Worksheet '{user_keyword}' not found. Creating it...")
            worksheet = spreadsheet.add_worksheet(title=user_keyword, rows="1000", cols="20")
            worksheet.append_row(['NAME', 'ADDRESS', 'PHONE', 'WEBSITE', 'EMAIL', 'COUNTRY', 'KEYWORD', 'CITY'])

        # --- Get existing keys for this worksheet ---
        print(f"[{user_keyword}] Fetching existing data to prevent duplicates...")
        headers = worksheet.row_values(1)
        if 'EMAIL' not in headers:
            worksheet.update_cell(1, 5, 'EMAIL') # Add header if missing

        existing_records = worksheet.get_all_records()
        existing_business_keys = {(rec['NAME'], rec['ADDRESS']) for rec in existing_records if 'NAME' in rec and 'ADDRESS' in rec}
        print(f"[{user_keyword}] Found {len(existing_business_keys)} existing records.")
        
        total_added_for_this_keyword = 0
        
        # --- Loop through locations for this one keyword ---
        for loc_index, location in enumerate(locations_list): 
            user_country, user_country_code = get_country_for_location(location)
            print(f"\n[{user_keyword}] Processing Location {loc_index + 1}/{len(locations_list)}: '{location}'")
            
            newly_added = find_and_save_dynamically(
                user_keyword, location, user_country, user_country_code, 
                worksheet, # Pass the G-Sheet object
                existing_business_keys # Pass the local set
            )
            total_added_for_this_keyword += newly_added
            print(f"--- [{user_keyword}] Finished '{location}'. Added {newly_added}. ---")

        print(f"\n--- Process finished for keyword: '{user_keyword}'. Total added: {total_added_for_this_keyword} ---")
        return total_added_for_this_keyword

    except FileNotFoundError:
        print(f"⛔ [{user_keyword}] ERROR: 'service_account.json' not found. Process can't start.")
        return 0
    except Exception as e:
        print(f"⛔ [{user_keyword}] An unexpected error occurred: {e}")
        return 0


# --- Main script execution ---
if __name__ == "__main__":
    
    keywords_input = input("Enter business keywords, separated by commas (e.g., 'photo studio, cafe, gym'): ")
    keywords_list = [kw.strip() for kw in keywords_input.split(',') if kw.strip()]

    locations_input = input(f"Enter locations, separated by commas (e.g., 'New Delhi, London, New York'): ")
    locations_list = [loc.strip() for loc in locations_input.split(',') if loc.strip()]

    # --- Ask for parallel process count ---
    max_processes = multiprocessing.cpu_count()
    print(f"\nYou have {max_processes} CPU cores.")
    print(f"It's recommended to run 2-{max_processes-1} parallel browsers.")
    
    parallel_count = input(f"How many keywords do you want to run in parallel at a time? (Max {len(keywords_list)}): ")
    try:
        num_processes = min(int(parallel_count), len(keywords_list))
    except ValueError:
        print("Invalid number. Defaulting to 1.")
        num_processes = 1

    print(f"\nStarting {num_processes} parallel process(es) for {len(keywords_list)} keyword(s)...")
    
    if not keywords_list or not locations_list:
        print("No keywords or locations entered. Exiting.")
    else:
        # --- Create a partial function to pass the constant 'locations_list' ---
        task_with_locations = partial(process_keyword_task, locations_list=locations_list)
        
        # --- Run the pool ---
        try:
            # Set start method to 'spawn' for stability, especially on Windows/macOS
            multiprocessing.set_start_method('spawn', force=True) 
            with multiprocessing.Pool(processes=num_processes) as pool:
                # 'map' will run the function for each item in 'keywords_list'
                results = pool.map(task_with_locations, keywords_list)
            
            total_added_count = sum(results)
            print("\n\n--- All keywords and locations processed. ---")
            print(f"✅ Total new businesses added in this session: {total_added_count}")

        except Exception as e:
            print(f"⛔ An main processing error occurred: {e}")