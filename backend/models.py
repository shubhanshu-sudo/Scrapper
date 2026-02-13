from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ScrapeRequest(BaseModel):
    keywords: List[str]
    locations: List[str]
    parallel_count: int = 1

class BusinessLead(BaseModel):
    name: str
    address: str
    phone: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    country: str
    keyword: str
    city: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ScrapeStatus(BaseModel):
    task_id: str
    status: str # "running", "completed", "failed"
    progress: int # percentage
    leads_found: int
    message: Optional[str] = None

class BulkDeleteRequest(BaseModel):
    lead_ids: List[str]
