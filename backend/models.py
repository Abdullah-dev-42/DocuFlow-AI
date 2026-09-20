from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    extracted_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    analysis = relationship("Analysis", back_populates="document", cascade="all, delete-orphan")
    actions = relationship("Action", back_populates="document", cascade="all, delete-orphan")


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    summary = Column(Text, nullable=True)
    document_type = Column(String(255), nullable=True)
    key_points = Column(JSON, default=list)
    deadlines = Column(JSON, default=list)
    responsibilities = Column(JSON, default=list)
    rules = Column(JSON, default=list)
    risks = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="analysis")


class Action(Base):
    __tablename__ = "actions"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(20), nullable=False, default="Medium")
    deadline = Column(String(255), nullable=True)
    status = Column(String(30), nullable=False, default="Pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="actions")
