from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class DeadlineItem(BaseModel):
    title: str
    date: Optional[str] = None
    description: Optional[str] = None


class ActionItem(BaseModel):
    title: str
    description: str
    priority: str = Field(default="Medium")
    deadline: Optional[str] = None


class RiskItem(BaseModel):
    title: str
    description: str
    severity: str = Field(default="Medium")


class AnalysisCreate(BaseModel):
    summary: Optional[str] = None
    document_type: Optional[str] = None
    key_points: List[str] = Field(default_factory=list)
    deadlines: List[DeadlineItem] = Field(default_factory=list)
    responsibilities: List[str] = Field(default_factory=list)
    rules: List[str] = Field(default_factory=list)
    risks: List[RiskItem] = Field(default_factory=list)
    actions: List[ActionItem] = Field(default_factory=list)


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    summary: Optional[str]
    document_type: Optional[str]
    key_points: List[str]
    deadlines: List[dict]
    responsibilities: List[str]
    rules: List[str]
    risks: List[dict]
    created_at: datetime


class ActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    title: str
    description: str
    priority: str
    deadline: Optional[str]
    status: str
    created_at: datetime


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_filename: str
    stored_filename: str
    file_path: str
    extracted_text: str
    created_at: datetime


class DocumentDetailResponse(DocumentResponse):
    analysis: Optional[AnalysisResponse] = None
    actions: List[ActionResponse] = []


class UploadResponse(BaseModel):
    message: str
    document: DocumentResponse


class ActionStatusUpdate(BaseModel):
    status: str
