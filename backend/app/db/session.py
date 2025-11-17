# session.py
import os
from sqlmodel import create_engine, Session
from dotenv import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(SQLALCHEMY_DATABASE_URL, echo=True)

def SessionLocal():
    return Session(engine)
