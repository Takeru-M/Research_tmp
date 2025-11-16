import os
import mysql.connector
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # Next.jsからのアクセスを許可するため
from dotenv import load_dotenv

load_dotenv()

# 環境変数の読み込み
DB_HOST = os.getenv("MYSQL_HOST")
DB_USER = os.getenv("MYSQL_USER")
DB_ROOT = os.getenv("MYSQL_ROOT")
DB_PASSWORD = os.getenv("MYSQL_PASSWORD")
DB_ROOT_PASSWORD = os.getenv("MYSQL_ROOT_PASSWORD")
DB_NAME = os.getenv("MYSQL_DATABASE")

app = FastAPI()

# TODO: docker用に変更
# CORS設定
origins = [
    # "http://localhost:3000",
    "*"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# データベース接続関数
def get_db_connection():
    try:
        conn = mysql.connector.connect(
            host=DB_HOST,
            # user=DB_USER,
            user=DB_ROOT,
            password=DB_ROOT_PASSWORD,
            database=DB_NAME
        )
        return conn
    except mysql.connector.Error as err:
        print(f"Error: {err}")
        return None

# DBテーブル作成（起動時に実行）
def create_table_if_not_exists():
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        try:
            # itemテーブルが存在しない場合に作成
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS items (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    price INT
                );
            """)
            conn.commit()
            print("Table 'items' checked/created successfully.")
        except Exception as e:
            print(f"Error creating table: {e}")
        finally:
            cursor.close()
            conn.close()

# アプリケーション起動時にテーブル作成を実行
@app.on_event("startup")
async def startup_event():
    create_table_if_not_exists()

# ✅ テスト用エンドポイント: DBから全アイテムを取得
@app.get("/api/items")
def read_items():
    conn = get_db_connection()
    if not conn:
        return {"error": "Database connection failed"}

    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM items")
    items = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    # データがない場合はテストデータを挿入
    if not items:
        # ダミーデータの挿入
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO items (name, price) VALUES (%s, %s)", ("Test Item A", 100))
        cursor.execute("INSERT INTO items (name, price) VALUES (%s, %s)", ("Test Item B", 200))
        conn.commit()
        cursor.close()
        conn.close()
        
        # 再度データ取得
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM items")
        items = cursor.fetchall()
        cursor.close()
        conn.close()
        
    return {"items": items}

# ✅ 基本テスト用エンドポイント
@app.get("/api/")
def read_root():
    return {"message": "Hello from FastAPI backend!"}