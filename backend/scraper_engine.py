import time
import re
import random
import os
import asyncio
import requests
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import phonenumbers
from phonenumbers import phonenumberutil

# Import DB
from database import db

def get_country_for_location(location):
    try:
        from geopy.geocoders import Nominatim
        geolocator = Nominatim(user_agent="map_scrape_v2_fast")
        location_data = geolocator.geocode(location, addressdetails=True, language="en", timeout=5)
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

def fast_extract_email(url):
    """Ultra-fast email extraction without opening a browser tab"""
    if not url or url == "No website": return "No email"
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        response = requests.get(url, headers=headers, timeout=5, verify=False)
        emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', response.text)
        if emails:
            clean = [e for e in emails if not any(x in e.lower() for x in ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'])]
            return clean[0] if clean else "No email"
    except:
        pass
    return "No email"

def find_and_save_dynamically(keyword, location, user_country, user_country_code, existing_keys, task_id, start_prog, end_prog):
    from main import tasks
    search_query = f"{keyword} in {location}".replace(" ", "+")
    url = f"https://www.google.com/maps/search/{search_query}" 

    options = webdriver.ChromeOptions()
    options.add_argument('--headless=new') 
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1280,720')
    options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    options.add_argument('--log-level=3')
    
    driver = None
    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        wait = WebDriverWait(driver, 10) 
        driver.get(url)

        # Handle Privacy Consent
        try:
            reject_button = WebDriverWait(driver, 3).until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Reject all')] | //button[contains(., 'Rechazar todo')]")))
            reject_button.click()
        except: pass

        tasks[task_id].message = f"Scanning {keyword}..."
        
        # FASTER SCROLLING
        try:
            scrollable_div = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'div[role="feed"]')))
            for s in range(15): # Balanced for Render: 15 scrolls give enough results quickly
                driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", scrollable_div)
                time.sleep(1.5)
                # Small progress boost
                tasks[task_id].progress = int(start_prog + (end_prog - start_prog) * (0.05 + (s/15)*0.10))
        except: pass

        business_card_selector = 'a.hfpxzc, a[href*="/maps/place/"]'
        elements = driver.find_elements(By.CSS_SELECTOR, business_card_selector)
        business_links = list(dict.fromkeys([elem.get_attribute('href') for elem in elements if elem.get_attribute('href')]))
        
        total_links = len(business_links)
        proc_start = start_prog + (end_prog - start_prog) * 0.15
        proc_range = (end_prog - start_prog) * 0.85

        for i, link in enumerate(business_links):
            try:
                tasks[task_id].progress = min(int(proc_start + (i / total_links) * proc_range), 99)
                tasks[task_id].message = f"Processing {i+1}/{total_links} for {keyword}"

                driver.get(link)
                # Wait for h1 to ensure page load
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'h1')))
                
                name = driver.find_element(By.CSS_SELECTOR, 'h1').text
                
                try: website = driver.find_element(By.CSS_SELECTOR, 'a[data-item-id="authority"]').get_attribute('href')
                except: website = "No website"
                
                try: address = driver.find_element(By.CSS_SELECTOR, 'button[data-item-id="address"] div.Io6YTe').text
                except: address = "No address"
                
                try: phone = driver.find_element(By.CSS_SELECTOR, 'button[data-item-id^="phone:tel:"] div.Io6YTe').text
                except: phone = "No phone"
                
                formatted_phone = validate_and_get_phone(phone, user_country_code)
                item_key = f"{name}-{address}"
                
                if formatted_phone and item_key not in existing_keys:
                    # FAST EMAIL EXTRACTION (NO BROWSER TAB)
                    email = fast_extract_email(website)
                    
                    lead_data = {
                        "name": name, "address": address, "phone": formatted_phone,
                        "website": website, "email": email, "country": user_country,
                        "keyword": keyword, "city": location, "task_id": task_id,
                        "timestamp": datetime.utcnow()
                    }
                    
                    from database import db_sync
                    db_sync.leads.insert_one(lead_data)
                    existing_keys.add(item_key)
                    tasks[task_id].leads_found += 1
                
            except: pass

        return len(business_links)
    finally:
        if driver: driver.quit()

def run_scraper_task(task_id, keywords, locations):
    from main import tasks 
    from database import db_sync 
    
    try:
        existing_keys = set()
        num_queries = len(keywords) * len(locations)
        query_weight = 100 / num_queries if num_queries > 0 else 100
        
        for idx, kw in enumerate(keywords):
            for loc in locations:
                start_prog = idx * query_weight
                end_prog = (idx + 1) * query_weight
                
                user_country, user_country_code = get_country_for_location(loc)
                find_and_save_dynamically(kw, loc, user_country, user_country_code, existing_keys, task_id, start_prog, end_prog)

        tasks[task_id].status = "completed"
        tasks[task_id].progress = 100
        tasks[task_id].message = f"Collection Optimized! Found {tasks[task_id].leads_found} leads."
    except Exception as e:
        tasks[task_id].status = "failed"
        tasks[task_id].message = f"Error: {str(e)}"
