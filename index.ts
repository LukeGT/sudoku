import * as _ from 'lodash';

interface Coordinates {
  row: number;
  col: number;
  box: number;
}

class Puzzle {
  numbers: (number | null)[];
  shadings: (boolean | null)[];

  constructor(
    public size: number,
    public box_width: number,
    public box_height: number,
    numbers: (number | null)[] = [],
    shadings: (boolean | null)[] = [],
  ) {
    this.numbers = this.load(numbers);
    this.shadings = Array.from({ length: this.size * this.size }, (_, index) => shadings[index] ?? null);
  }

  load(numbers: (number | null)[]) {
    return (this.numbers = Array.from({ length: this.size * this.size }, (_, index) => numbers[index] || null));
  }

  solve(solutions: Puzzle[], solution_num: number = Infinity) {
    let min_index: number | null = null;
    let min_score: number | null = null;
    let min_number_possibilities: number[] | null = null;
    let min_shading_possibilities: boolean[] | null = null;
    let min_count = 0;

    for (let index = 0; index < this.numbers.length; ++index) {
      if (this.numbers[index] === null) {
        const poss = this.number_possibilities(index);
        if (poss.length <= (min_score ?? Infinity)) {
          if (poss.length !== min_score) {
            min_count = 0;
            min_score = poss.length;
          }
          min_count += 1;
          if (min_count === 1 || Math.random() < 1 / min_count) {
            min_index = index;
            min_number_possibilities = poss;
            min_shading_possibilities = null;
          }
        }
      }
      if (this.shadings[index] === null) {
        const poss = this.shading_possibilities(index);
        const score = (poss.length - 1) * this.size + 1;
        if (score <= (min_score ?? Infinity)) {
          if (score !== min_score) {
            min_count = 0;
            min_score = score;
          }
          min_count += 1;
          if (min_count === 1 || Math.random() < 1 / min_count) {
            min_index = index;
            min_number_possibilities = null;
            min_shading_possibilities = poss;
          }
        }
      }

      if (min_score && min_score <= 0) return solutions;
    }

    if (min_index === null) {
      solutions.push(new Puzzle(this.size, this.box_width, this.box_height, this.numbers, this.shadings));
      return solutions;
    }

    if (min_number_possibilities !== null) {
      for (const number of _.shuffle(min_number_possibilities)) {
        this.numbers[min_index] = number;
        this.solve(solutions, solution_num);
        this.numbers[min_index] = null;
        if (solutions.length >= solution_num) return solutions;
      }
    }

    if (min_shading_possibilities !== null) {
      for (const shading of _.shuffle(min_shading_possibilities)) {
        this.shadings[min_index] = shading;
        this.solve(solutions, solution_num);
        this.shadings[min_index] = null;
        if (solutions.length >= solution_num) return solutions;
      }
    }

    return solutions;
  }

  is_number_needed(index: number) {
    const possibilities = this.number_possibilities(index);
    if (possibilities.length === 1) {
      return false;
    }
    const number = this.numbers[index];
    this.numbers[index] = null;
    const solutions = this.solve([], 2);
    this.numbers[index] = number;
    return solutions.length > 1;
  }

  check(index: number) {
    const shading = this.shadings[index];
    const number = this.numbers[index];
    const coords = this.get_coordinates(index);

    if (number !== null) {
      for (let i = 0; i < this.numbers.length; ++i) {
        if (i === index) continue;
        if (this.numbers[i] !== number) continue;

        const other_coords = this.get_coordinates(i);
        if (coords.row === other_coords.row || coords.col === other_coords.col || coords.box == other_coords.box) {
          return false;
        }
      }
    }

    if (number !== null && shading !== null) {
      for (const offset of [-1, 1, this.size, -this.size]) {
        const neighbour_index = index + offset;
        if (neighbour_index < 0 || neighbour_index >= this.size * this.size) continue;
        if (offset === -1 && index % this.size === 0) continue;
        if (offset === 1 && index % this.size === this.size - 1) continue;
        const neighbour_number = this.numbers[neighbour_index];
        const neighbour_shading = this.shadings[neighbour_index];
        if (neighbour_number === null || neighbour_shading === null || neighbour_shading === shading) continue;

        if (number > neighbour_number !== shading) {
          return false;
        }
      }
    }

    return true;
  }

  number_possibilities(index: number) {
    const original = this.numbers[index];
    const possibilities: number[] = [];

    for (let number = 1; number <= this.size; ++number) {
      this.numbers[index] = number;
      if (this.check(index)) {
        possibilities.push(number);
      }
    }

    this.numbers[index] = original;
    return possibilities;
  }

  shading_possibilities(index: number) {
    const original = this.shadings[index];
    const possibilities: boolean[] = [];

    for (const shading of [true, false]) {
      this.shadings[index] = shading;
      if (this.check(index)) {
        possibilities.push(shading);
      }
    }

    this.shadings[index] = original;
    return possibilities;
  }

  get_coordinates(index: number) {
    const row = Math.floor(index / this.size);
    const col = index % this.size;
    const box_row = Math.floor(row / this.box_height);
    const box_col = Math.floor(col / this.box_width);
    const box = box_row + box_col * this.box_width;

    return { row, col, box };
  }

  print() {
    for (let index = 0; index < this.size * this.size; ++index) {
      if (this.shadings[index]) {
        process.stdout.write('\u001b[44m');
      }
      if (this.shadings[index] === false) {
        process.stdout.write('\u001b[41m');
      }
      process.stdout.write(this.numbers[index]?.toString() ?? '-');
      if (this.shadings[index] !== null) {
        process.stdout.write('\u001b[0m');
      }
      if (index % this.size === this.size - 1) {
        process.stdout.write('\n');
      } else {
        process.stdout.write(' ');
      }
    }
  }
}

const puzzle = new Puzzle(
  9,
  3,
  3,
  [
    0, 0, 0, 0, 6, 0, 0, 2, 0, 0, 0, 7, 0, 2, 9, 0, 0, 0, 4, 0, 0, 0, 0, 1, 7, 3, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 5, 0,
    8, 7, 0, 3, 0, 0, 0, 0, 9, 0, 0, 6, 0, 0, 0, 0, 0, 4, 7, 0, 0, 0, 0, 0, 9, 0, 5, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 5, 8,
    0, 0, 1,
  ],
);

const solutions = puzzle.solve([], 2);

console.log('solutions:', solutions.length);
puzzle.print();
solutions[0].print();

console.log('generating new puzzle');
const new_solve = new Puzzle(9, 3, 3).solve([], 1);
const new_puzzle = new_solve[0];

new_puzzle.print();

while (true) {
  let reduce_candidate = Math.floor(Math.random() * new_puzzle.size * new_puzzle.size);
  let attempts = 0;
  for (attempts = 0; attempts < new_puzzle.size * new_puzzle.size; ++attempts) {
    reduce_candidate = (reduce_candidate + 1) % (new_puzzle.size * new_puzzle.size);
    if (new_puzzle.numbers[reduce_candidate] === null || new_puzzle.is_number_needed(reduce_candidate)) continue;
    break;
  }
  if (attempts >= new_puzzle.size * new_puzzle.size) break;
  new_puzzle.numbers[reduce_candidate] = null;
}

new_puzzle.print();
