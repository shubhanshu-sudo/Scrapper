import time
import re
import random
import os
import asyncio
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import multiprocessing
from functools import partial
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable
import phonenumbers
from phonenumbers import phonenumberutil

# Import DB
from database import db

def get_country_for_location(location):
    try:
        geolocator = Nominatim(user_agent="map_scrape_pro_v2.1")
        location_data = geolocator.geocode(location, addressdetails=True, language="en", timeout=10)
        if location_data and 'address' in location_data.raw and 'country' in location_data.raw['address']:
            return location_data.raw['address']['country'], location_data.raw['address']['country_code'].upper()
    except:
        pass
    return "India", "IN"

def validate_and_get_phone(phone_number_str, country_code):
    if not phone_number_str or phone_number_str == "No phone": return None
    try:
        parsed_number = phonenumbers.parse(phone_number_str, country_code)
        if phonenumbers.is_valid_number(parsed_number):
            return phonenumbers.format_number(parsed_number, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
    except:
        pass
    return phone_number_str

def find_and_save_dynamically(keyword, location, user_country, user_country_code, existing_keys, task_id, start_prog, end_prog):
    from main import tasks
    search_query = f"{keyword} in {location}".replace(" ", "+")
    url = f"https://www.google.com/maps/search/{search_query}" 

    service = Service(ChromeDriverManager().install())
    options = webdriver.ChromeOptions()
    options.add_argument('--headless=new') 
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    options.add_argument('--log-level=3')
    
    driver = None
    try:
        driver = webdriver.Chrome(service=service, options=options)
        wait = WebDriverWait(driver, 20) 
        driver.get(url)

        # Handle Privacy Consent
        try:
            reject_button = WebDriverWait(driver, 5).until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Reject all')] | //button[contains(., 'Rechazar todo')]")))
            reject_button.click()
        except: pass

        tasks[task_id].message = f"Discovering leads for '{keyword}'..."
        tasks[task_id].progress = int(start_prog + (end_prog - start_prog) * 0.05)

        # DEEP SCROLLING
        try:
            scrollable_div = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'div[role="feed"]')))
            last_height = driver.execute_script("return arguments[0].scrollHeight", scrollable_div)
            
            for s in range(25): 
                driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", scrollable_div)
                time.sleep(2)
                # Incremental progress during scroll (up to 15% of this segment)
                tasks[task_id].progress = int(start_prog + (end_prog - start_prog) * (0.05 + (s/25)*0.10))
                
                new_height = driver.execute_script("return arguments[0].scrollHeight", scrollable_div)
                if new_height == last_height: break
                last_height = new_height
        except: pass

        business_card_selector = 'a.hfpxzc, a[href*="/maps/place/"]'
        elements = driver.find_elements(By.CSS_SELECTOR, business_card_selector)
        business_links = list(dict.fromkeys([elem.get_attribute('href') for elem in elements if elem.get_attribute('href')]))
        
        total_links = len(business_links)
        added_count = 0
        original_tab = driver.current_window_handle
        
        # Segment progress: 15% spent on discovery, 85% on processing
        proc_start = start_prog + (end_prog - start_prog) * 0.15
        proc_range = (end_prog - start_prog) * 0.85

        for i, link in enumerate(business_links):
            try:
                # Update progress per lead
                curr_lead_prog = int(proc_start + (i / total_links) * proc_range)
                tasks[task_id].progress = min(curr_lead_prog, 99)
                tasks[task_id].message = f"Extracting lead {i+1} of {total_links} for '{keyword}'"

                driver.get(link)
                time.sleep(2)
                
                try: name = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'h1'))).text
                except: name = "Unknown"
                
                try: website = driver.find_element(By.CSS_SELECTOR, 'a[data-item-id="authority"]').get_attribute('href')
                except: website = "No website"
                
                try: address = driver.find_element(By.CSS_SELECTOR, 'button[data-item-id="address"] div.Io6YTe').text
                except: address = "No address"
                
                try: phone = driver.find_element(By.CSS_SELECTOR, 'button[data-item-id^="phone:tel:"] div.Io6YTe').text
                except: phone = "No phone"
                
                formatted_phone = validate_and_get_phone(phone, user_country_code)
                item_key = f"{name}-{address}"
                
                if formatted_phone and item_key not in existing_keys:
                    email = "No email"
                    # Fast Email check only if needed (Skipping deep check for speed if many results)
                    # If you want emails always, keep the window.open logic here
                    
                    lead_data = {
                        "name": name, "address": address, "phone": formatted_phone,
                        "website": website, "email": email, "country": user_country,
                        "keyword": keyword, "city": location, "task_id": task_id,
                        "timestamp": datetime.utcnow()
                    }
                    
                    from database import db_sync
                    try: 
                        db_sync.leads.insert_one(lead_data)
                        added_count += 1
                        existing_keys.add(item_key)
                        # Also update total leads found in status
                        tasks[task_id].leads_found += 1
                    except: pass
                
            except: pass

        return added_count
    finally:
        if driver: driver.quit()

def run_scraper_task(task_id, keywords, locations):
    from main import tasks 
    from database import db_sync 
    
    total_found = 0
    try:
        existing_keys = set()
        num_queries = len(keywords) * len(locations)
        query_weight = 100 / num_queries if num_queries > 0 else 100
        
        current_query_idx = 0
        for kw in keywords:
            for loc in locations:
                start_prog = current_query_idx * query_weight
                end_prog = (current_query_idx + 1) * query_weight
                
                user_country, user_country_code = get_country_for_location(loc)
                
                # Pass range to sub-function for smooth progress
                find_and_save_dynamically(
                    kw, loc, user_country, user_country_code, 
                    existing_keys, task_id, start_prog, end_prog
                )
                
                current_query_idx += 1

        tasks[task_id].status = "completed"
        tasks[task_id].progress = 100
        tasks[task_id].message = f"Collection Complete! Total business leads: {tasks[task_id].leads_found}"

    except Exception as e:
        tasks[task_id].status = "failed"
        tasks[task_id].message = f"Error: {str(e)}"
