from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uuid
from typing import List, Dict
from models import ScrapeRequest, ScrapeStatus, BusinessLead, BulkDeleteRequest
from database import test_connection, db
from scraper_engine import run_scraper_task # We'll implement the actual task runner details

app = FastAPI(title="Maps Scraper API")

# Enable CORS for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory task tracking (In production, use Redis)
tasks: Dict[str, ScrapeStatus] = {}

@app.on_event("startup")
async def startup_db_client():
    await test_connection()

@app.get("/")
async def root():
    return {"message": "Maps Scraper API is running!"}

import threading

@app.post("/scrape", response_model=ScrapeStatus)
async def start_scraping(request: ScrapeRequest):
    task_id = str(uuid.uuid4())
    
    status = ScrapeStatus(
        task_id=task_id,
        status="running",
        progress=0,
        leads_found=0,
        message=f"Starting scraping mission for {len(request.keywords)} keywords..."
    )
    tasks[task_id] = status
    
    # Run scraping in a separate thread because it's blocking (Selenium)
    thread = threading.Thread(
        target=run_scraper_task, 
        args=(task_id, request.keywords, request.locations)
    )
    thread.start()
    
    return status

@app.get("/status/{task_id}", response_model=ScrapeStatus)
async def get_status(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks[task_id]

@app.get("/leads/all")
async def get_all_leads(
    page: int = 1, 
    limit: int = 50, 
    search: str = None, 
    keyword: str = None
):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}},
            {"address": {"$regex": search, "$options": "i"}}
        ]
    if keyword:
        query["keyword"] = keyword

    total = await db.leads.count_documents(query)
    skip = (page - 1) * limit
    
    leads = await db.leads.find(query).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    for lead in leads:
        lead["_id"] = str(lead["_id"])
        
    return {
        "leads": leads,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

@app.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str):
    from bson import ObjectId
    result = await db.leads.delete_one({"_id": ObjectId(lead_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"message": "Lead deleted successfully"}

@app.post("/leads/bulk-delete")
async def bulk_delete_leads(request: BulkDeleteRequest):
    from bson import ObjectId
    object_ids = [ObjectId(lid) for lid in request.lead_ids]
    result = await db.leads.delete_many({"_id": {"$in": object_ids}})
    return {"message": f"Successfully deleted {result.deleted_count} leads"}

@app.get("/stats")
async def get_stats():
    total_leads = await db.leads.count_documents({})
    # Count unique locations
    locations = await db.leads.distinct("city")
    return {
        "total_leads": total_leads,
        "locations_count": len(locations),
        "success_rate": "95%", # Placeholder
        "growth": "+5%" # Placeholder
    }

@app.get("/keywords")
async def get_keywords():
    keywords = await db.leads.distinct("keyword")
    return keywords

@app.get("/leads/{task_id}")
async def get_leads(task_id: str):
    leads = await db.leads.find({"task_id": task_id}).to_list(1000)
    for lead in leads:
        lead["_id"] = str(lead["_id"])
    return leads
    try:
        tasks[task_id].status = "running"
        tasks[task_id].progress = 10
        tasks[task_id].message = "Initializing browsers..."
        
        # Here we would call the parallel scraping logic
        # For now, let's simulate progress
        for i in range(1, 10):
            await asyncio.sleep(2) # Simulate work
            tasks[task_id].progress = 10 + (i * 10)
            tasks[task_id].leads_found += random.randint(1, 5)
            tasks[task_id].message = f"Found {tasks[task_id].leads_found} leads so far..."
            
        tasks[task_id].status = "completed"
        tasks[task_id].progress = 100
        tasks[task_id].message = "Scraping finished successfully!"
        
    except Exception as e:
        tasks[task_id].status = "failed"
        tasks[task_id].message = f"Error: {str(e)}"

import random
