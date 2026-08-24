"""Configuração do banco de dados SQLite via SQLAlchemy."""
from sqlalchemy import create_engine, Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from datetime import datetime
from backend.config import settings


class Base(DeclarativeBase):
    pass


class PolaroidDB(Base):
    """Tabela de Polaroids gerados."""
    __tablename__ = "polaroids"

    id = Column(String(20), primary_key=True)
    session_id = Column(String(40), nullable=False)
    campaign_id = Column(String(100), nullable=False)
    participant_name = Column(String(100), nullable=True)
    phrase = Column(Text, nullable=False)
    image_path = Column(Text, nullable=False)
    polaroid_path = Column(Text, nullable=False)
    qrcode_path = Column(Text, nullable=False)
    qrcode_url = Column(Text, nullable=False)
    printed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Cria as tabelas no banco de dados."""
    Base.metadata.create_all(bind=engine)
