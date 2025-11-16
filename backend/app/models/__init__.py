# app/models/__init__.py

# models ディレクトリ内のすべてのモデル定義をインポートする
# これにより、それぞれのファイル内で定義された SQLModel クラスが
# SQLModel.metadata に登録されます。

from .user import User

# 他のモデルファイルもすべてここに記述します
# from .order import Order
# from .category import Category

# オプション: 外部から User や Product を直接使えるようにするため
__all__ = ["User"]