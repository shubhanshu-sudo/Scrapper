import os
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "maps_scraper")

# Async client for FastAPI
client = AsyncIOMotorClient(MONGODB_URI)
db = client[DATABASE_NAME]

# Sync client for Background Workers
sync_client = MongoClient(MONGODB_URI)
db_sync = sync_client[DATABASE_NAME]

async def get_database():
    return db

async def test_connection():
    try:
        await client.admin.command('ping')
        print("✅ Successfully connected to MongoDB!")
    except Exception as e:
        print(f"❌ Could not connect to MongoDB: {e}")
