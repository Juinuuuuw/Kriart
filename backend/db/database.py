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


class SurveyResponseDB(Base):
    """Respostas do formulário pré e pós-teste da pesquisa."""
    __tablename__ = "survey_responses"

    session_id = Column(String(40), primary_key=True)
    status = Column(String(50), default="Aguardando pós-teste") # 'Não adepta', 'Aguardando pós-teste', 'Desistiu', 'Adepta ao estudo'
    
    # Pré-teste
    termo_aceito = Column(Boolean, default=False)
    idade = Column(String(50), nullable=True)
    escolaridade = Column(String(100), nullable=True)
    genero = Column(String(50), nullable=True)
    uso_ia = Column(String(100), nullable=True)
    finalidades_ia = Column(Text, nullable=True)
    percepcao_q6 = Column(String(10), nullable=True)
    percepcao_q7 = Column(String(10), nullable=True)
    percepcao_q8 = Column(String(10), nullable=True)
    percepcao_q9 = Column(String(10), nullable=True)
    percepcao_q10 = Column(String(10), nullable=True)
    
    # Pós-teste (a definir depois)
    post_test_data = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Cria as tabelas no banco de dados."""
    Base.metadata.create_all(bind=engine)
