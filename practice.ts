// switch文
// 復習
function getSizeName(size: 's' | 'm' | 'l'): string {
  switch(size) {
    case 's': return 'small';
    case 'm': return 'medium';
    case 'l': return 'large';
    default : return 'unknown';
  }
}

// オブジェクト
interface Person {
  name: string;
  age: number;
}

const person: Person = {
  name: "Alice",
  age: 30,
}

// 配列
const numbers: number[] = [1, 2, 3];
const various: (string | number)[] = ["hello", 42, "world"];

// タプル
const tuple: [string, number] = ["age", 25];

// 列挙型（型＋オブジェクト）
enum CoffeeSize {
  SHORT = 'SHORT',
  TALL = 'TALL',
  GRANDE = 'GRANDE',
  VENTI = 'VENTI',
}

enum CoffeeSize2 {
  SHORT,
  TALL,
  GRANDE,
  VENTI,
}

// リテラル型
let coffeeSize: 'SHORT' | 'TALL' | 'GRANDE' | 'VENTI' = 'TALL';

// typealias
type Coffee = {
  size: CoffeeSize;
  price: number;
  sugar?: boolean; // 任意プロパティ
}

const myCoffee: Coffee = {
  size: CoffeeSize.GRANDE,
  price: 400,
};

// 関数
function add(num1: number, num2: number) {
  return num1 + num2;
}

// 関数型
const anotherAdd: (n1: number, n2: number) => number = add;

// アロー関数
const doubleNumber = (number: number): number => number * 2;
const doubleNumber2: (number: number) => number = number => number * 2;

// unknown型
const unknownInput: unknown = 'Hello';
if (typeof unknownInput === 'string') {
  console.log(unknownInput.toUpperCase());
}

// satisfies演算子
// 復習
const age = 28 satisfies number;

// never型
// 復習
function error(message: string): never {
  throw new Error(message);
}

function fail() {
  return error('Something failed');
}