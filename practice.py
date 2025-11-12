# リスト
list1 = [1, 2, 3, 4, 5]

# 追加
list1.append(4)
list1.insert(4, 8)

# 削除
del list1[0]
list1.remove(2)

# コピー
list2 = list1.copy()
del list2[2]

# 連結
list3 = list1 + list2
list1.extend(list2)
list1 += list2

# スライス[開始値：終了値：間隔]
print(list1[0:7:2])

# 逆順
# ------イテレータ------
# メソッドを用いると元の配列が変更される
print(list1[::-1])
reversed(list1)
list1.reverse()

print(list1)
print(list2)

# リスト要素の組み合わせ
for i in zip(list1, list2):
  print(i)

for i in enumerate(list2):
  print(i)

# リスト要素の分解（アンパック）
for i, j in zip(list1, list2):
  print(i, j)

# ------リスト内包表記------
print([i*2 for i in list2 if i==3])

# ソート
print(sorted(list2, reverse=True))
list2.sort()
print(list2)

# タプル
# リストは同じ型の集合，タプルは異なる型の集合で扱われることが多い．そのためリストはfor文，タプルはアンパックで処理されることが多い
tuple1 = (1, 2, 3)
tuple2 = tuple(list2)

print(tuple1)
print(tuple2)

# ディクショナリ
# キーの検索：キー in ディクショナリ
# 操作
# キーを一つずつ取得：ディクショナリ.keys()
# 値を一つずつ取得：ディクショナリ.values()
# {キー, 値}となるタプルを一つずつ取得：ディクショナリ.items()
# ディクショナリの更新：ディクショナリ1.update(ディクショナリ2)

# データが0や空
# 一つでも0や空があるとtrue：any(data), 全て0か空でなければtrue：all(data)
dict1 = {"a": 1, "b": 2}
print(dict1)

# セット
# セットは集合演算が可能
set1 = {"a", "b"}

# セットの操作
set1.add("c")
set1.remove("a")

print(set1)