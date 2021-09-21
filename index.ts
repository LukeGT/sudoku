import * as _ from 'lodash';

class Best<T> {
  value: T | null = null;
  score: number = Infinity;
  count: number = 0;

  constructor(private random: boolean) {}

  consider(value: T, score: number) {
    if (score < this.score) {
      this.count = 0;
      this.score = score;
    }
    if (score <= this.score) {
      ++this.count;
      if (this.count === 1 || (this.random && Math.random() < 1 / this.count)) {
        this.value = value;
      }
    }
  }
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

  $explore_any = false;
  $explore_any_chase_one = true;

  solve({
    solutions = [],
    solution_num = Infinity,
    random = false,
    numbers = true,
    shadings = true,
  }: {
    solutions?: Puzzle[];
    solution_num?: number;
    random?: boolean;
    numbers?: boolean;
    shadings?: boolean;
  } = {}) {
    if (solutions.length >= solution_num) return solutions;

    let best_number = new Best<{ index: number; possibilities: number[] }>(random && this.$explore_any);
    let best_shading = new Best<{ index: number; possibilities: boolean[] }>(random && this.$explore_any);

    for (let index = 0; index < this.numbers.length; ++index) {
      if (numbers && this.numbers[index] === null) {
        const possibilities = this.number_possibilities(index);
        const score = this.$explore_any
          ? Math.min(this.$explore_any_chase_one ? 2 : 1, possibilities.length)
          : possibilities.length;
        best_number.consider({ index, possibilities }, score);
      }

      if (shadings && this.shadings[index] === null) {
        const possibilities = this.shading_possibilities(index);
        const score = this.$explore_any
          ? Math.min(this.$explore_any_chase_one ? 2 : 1, possibilities.length)
          : (possibilities.length - 1) * this.size + 1;
        best_shading.consider({ index, possibilities }, score);
      }

      if (best_number.value?.possibilities.length === 0 || best_shading.value?.possibilities.length === 0)
        return solutions;
    }

    if (best_number.value === null && best_shading.value === null) {
      solutions.push(this.clone());
      return solutions;
    }

    const min_score = Math.min(best_number.score, best_shading.score);

    if (best_number.score === min_score && best_number.value !== null) {
      for (const number of random
        ? _.shuffle(best_number.value.possibilities)
        : best_number.value.possibilities ?? []) {
        this.numbers[best_number.value.index] = number;
        this.solve({ solutions, solution_num, random });
        this.numbers[best_number.value.index] = null;
        if (solutions.length >= solution_num) return solutions;
      }
    } else if (best_shading.score === min_score && best_shading.value !== null) {
      for (const shading of random ? _.shuffle(best_shading.value.possibilities) : best_shading.value.possibilities) {
        this.shadings[best_shading.value.index] = shading;
        this.solve({ solutions, solution_num, random });
        this.shadings[best_shading.value.index] = null;
        if (solutions.length >= solution_num) return solutions;
      }
    }

    return solutions;
  }

  reduce({
    max_reduce = Infinity,
    numbers = true,
    shadings = true,
  }: { max_reduce?: number; numbers?: boolean; shadings?: boolean } = {}) {
    console.log();

    for (let reductions = 0; reductions < max_reduce; ++reductions) {
      process.stdout.write(`\rReductions: ${reductions} + 0 `);
      const best_number = new Best<{ index: number; possibilities: number[] }>(true);
      const best_shading = new Best<{ index: number; possibilities: boolean[] }>(true);

      for (let index = 0; index < this.size * this.size; ++index) {
        if (numbers && this.numbers[index] !== null) {
          process.stdout.write(`\rReductions: ${reductions} + ${index}`);
          const number_possibilities = this.number_possibilities(
            index,
            (best_number.value?.possibilities.length ?? Infinity) + 1,
          );
          // TODO: Refactor this so that it doesn't call is_number_needed once for everything equal score
          if (number_possibilities.length <= best_number.score && !this.is_number_needed(index)) {
            best_number.consider({ index, possibilities: number_possibilities }, number_possibilities.length);
          }
        }
        if (shadings && this.shadings[index] !== null) {
          process.stdout.write(`\rReductions: ${reductions} + ${index}`);
          const shading_possibilities = this.shading_possibilities(
            index,
            (best_shading.value?.possibilities.length ?? Infinity) + 1,
          );
          const score = (shading_possibilities.length - 1) * this.size + 1;
          if (score <= best_shading.score && !this.is_shading_needed(index)) {
            best_shading.consider({ index, possibilities: shading_possibilities }, score);
          }
        }
      }

      if (best_number.value === null && best_shading.value === null) {
        break;
      }

      const min_score = Math.min(best_number.score, best_shading.score);
      if (best_number.score === min_score && best_number.value) {
        this.numbers[best_number.value.index] = null;
      } else if (best_shading.score === min_score && best_shading.value) {
        this.shadings[best_shading.value.index] = null;
      }
    }

    console.log();
  }

  // TODO: have shadings switch
  is_number_needed(index: number) {
    const possibilities = this.number_possibilities(index, 2);
    if (possibilities.length === 1) {
      return false;
    }
    const original_number = this.numbers[index];
    const solutions: Puzzle[] = [];
    for (let shading = 1; shading <= this.size; ++shading) {
      if (shading === original_number) continue;
      this.numbers[index] = shading;
      this.solve({ solutions, solution_num: 1 });
    }
    this.numbers[index] = original_number;
    return solutions.length > 0;
  }

  // TODO: have numbers switche
  is_shading_needed(index: number) {
    const possibilities = this.shading_possibilities(index, 2);
    if (possibilities.length === 1) {
      return false;
    }
    const original_shading = this.shadings[index];
    const solutions: Puzzle[] = [];
    for (const shading of [true, false]) {
      if (shading === original_shading) continue;
      this.shadings[index] = shading;
      this.solve({ solutions, solution_num: 1 });
    }
    this.shadings[index] = original_shading;
    return solutions.length > 0;
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
      for (const neighbour_index of this.neighbours(index)) {
        const neighbour_number = this.numbers[neighbour_index];
        const neighbour_shading = this.shadings[neighbour_index];
        // Shadings must be different for rules to apply
        if (neighbour_number === null || neighbour_shading === null || neighbour_shading === shading) continue;
        // Numbers in shaded cells are greater than their unshaded neighbours, and vice versa
        if (number > neighbour_number !== shading) {
          return false;
        }
      }
    }

    return true;
  }

  number_possibilities(index: number, possibility_num = Infinity) {
    const original = this.numbers[index];
    const possibilities: number[] = [];

    for (let number = 1; number <= this.size; ++number) {
      this.numbers[index] = number;
      if (this.check(index)) {
        possibilities.push(number);
        if (possibilities.length >= possibility_num) break;
      }
    }

    this.numbers[index] = original;
    return possibilities;
  }

  $basic_shade_explore = true;
  $times_improved_shading = 0;
  $times_identical_shading = 0;

  shading_possibilities(index: number, possibility_num = Infinity) {
    const original = this.shadings[index];
    const possibilities: boolean[] = [];

    for (const shading of [true, false]) {
      this.shadings[index] = shading;

      if (this.$basic_shade_explore) {
        if (this.check(index)) {
          possibilities.push(shading);
        }
        continue;
      }

      const original_verdict = this.check(index);
      let pushed = false;

      if (this.numbers[index] === null) {
        // Ensure that there's a number which could be placed in this cell
        const num_poss = this.number_possibilities(index, 1);
        if (num_poss.length > 0) {
          possibilities.push(shading);
          pushed = true;
        }
      } else {
        // Ensure that all neighbours have a possible number placement
        const possible = (() => {
          for (const neighbour of this.neighbours(index)) {
            const num_poss = this.number_possibilities(neighbour, 1);
            if (num_poss.length === 0) {
              return false;
            }
          }
          return true;
        })();
        if (possible) {
          possibilities.push(shading);
          pushed = true;
        }
      }

      if (original_verdict !== pushed) {
        ++this.$times_improved_shading;
      } else {
        ++this.$times_identical_shading;
      }

      if (possibilities.length >= possibility_num) break;
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

  *neighbours(index: number) {
    for (const offset of [-1, 1, this.size, -this.size]) {
      const neighbour_index = index + offset;
      // Check bounds
      if (neighbour_index < 0 || neighbour_index >= this.size * this.size) continue;
      if (offset === -1 && index % this.size === 0) continue;
      if (offset === 1 && index % this.size === this.size - 1) continue;
      yield neighbour_index;
    }
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

  hash() {
    let hash = 0n;
    for (const number of this.numbers) {
      hash *= BigInt(this.size + 1);
      hash += BigInt(number ?? 0);
    }
    for (const shading of this.shadings) {
      hash *= 3n;
      hash += shading === null ? 0n : shading ? 1n : 2n;
    }
    return hash;
  }

  clone() {
    return new Puzzle(this.size, this.box_width, this.box_height, this.numbers, this.shadings);
  }
}

function time<T>(task: () => T, runs = 1) {
  const times: number[] = [];

  for (let a = 0; a < runs - 1; ++a) {
    const start = Date.now();
    task();
    const time = Date.now() - start;
    times.push(time);
  }
  const start = Date.now();
  const result = task();
  const time = Date.now() - start;
  times.push(time);

  console.log('avg. time:', times.reduce((a, b) => a + b) / runs, times);

  return result;
}

{
  const puzzle = new Puzzle(
    9,
    3,
    3,
    [
      0, 0, 0, 0, 6, 0, 0, 2, 0, 0, 0, 7, 0, 2, 9, 0, 0, 0, 4, 0, 0, 0, 0, 1, 7, 3, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 5,
      0, 8, 7, 0, 3, 0, 0, 0, 0, 9, 0, 0, 6, 0, 0, 0, 0, 0, 4, 7, 0, 0, 0, 0, 0, 9, 0, 5, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0,
      5, 8, 0, 0, 1,
    ],
  );

  console.log('explore any chase one basic');
  puzzle.$explore_any = true;
  puzzle.$explore_any_chase_one = true;
  puzzle.$basic_shade_explore = true;
  time(() => puzzle.solve({ solution_num: 2, random: true }), 10);

  console.log('explore min basic shading');
  puzzle.$explore_any = false;
  puzzle.$basic_shade_explore = true;
  time(() => puzzle.solve({ solution_num: 2, random: true }), 10);

  console.log('explore min');
  puzzle.$explore_any = false;
  puzzle.$basic_shade_explore = false;
  const solutions = time(() => puzzle.solve({ solution_num: 2, random: true, shadings: false }), 10);

  console.log('solutions:', solutions.length);
  console.log('improved:', puzzle.$times_improved_shading);
  console.log('not-improved:', puzzle.$times_identical_shading);
  puzzle.print();
  solutions[0].print();
}

{
  const new_solve = new Puzzle(6, 3, 2).solve({ solution_num: 1, random: true });

  console.log('generating new puzzle');
  new_solve[0].print();

  time(() => {
    const new_puzzle = new_solve[0].clone();
    new_puzzle.$basic_shade_explore = true;
    new_puzzle.reduce();
    console.log('improved:', new_puzzle.$times_improved_shading);
    console.log('not-improved:', new_puzzle.$times_identical_shading);
    new_puzzle.print();

    console.log('solving...');
    const solutions = time(() => new_puzzle.solve({ solution_num: 2 }));
    solutions[0].print();
    if (solutions.length > 1) {
      solutions[1].print();
      throw new Error('NON UNIQUE');
    }
  });
}
