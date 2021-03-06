import * as _ from 'lodash';

type Solutions = Puzzle[] & { incomplete?: boolean };

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
  circles: (boolean | null)[];

  constructor(
    public size: number,
    public box_width: number,
    public box_height: number,
    numbers: (number | null)[] = [],
    shadings: (boolean | null)[] = [],
    circles: (boolean | null)[] = [],
  ) {
    this.numbers = this.numbers = Array.from({ length: this.size * this.size }, (_, index) => numbers[index] || null);
    this.shadings = Array.from({ length: this.size * this.size }, (_, index) => shadings[index] ?? null);
    this.circles = Array.from({ length: this.size * this.size }, (_, index) => circles[index] ?? null);
  }

  load(numbers: (number | null)[]) {
    return (this.numbers = Array.from({ length: this.size * this.size }, (_, index) => numbers[index] || null));
  }

  $explore_coordinates = true;

  solve({
    solutions = [],
    solution_num = Infinity,
    random = false,
    numbers = true,
    shadings = true,
    circles = false,
    depth = Infinity,
    max_steps = Infinity,
  }: {
    solutions?: Solutions;
    solution_num?: number;
    random?: boolean;
    numbers?: boolean;
    shadings?: boolean;
    circles?: boolean;
    depth?: number;
    max_steps?: number;
  } = {}) {
    const early_return = { solutions, steps: 0 };
    if (solutions.length >= solution_num) return early_return;

    if (depth <= 0 || max_steps < 1) {
      solutions.incomplete = true;
      return early_return;
    }

    if (Math.random() < 1 / 10000) this.print();

    let best_number = new Best<{ index: number; possibilities: number[] }>(random);
    let best_shading = new Best<{ index: number; possibilities: boolean[] }>(random);

    for (let index = 0; index < this.numbers.length; ++index) {
      if (numbers && this.numbers[index] === null) {
        const possibilities = this.number_possibilities(
          index,
          (best_number.value?.possibilities.length ?? Infinity) + 1,
        );
        const score = possibilities.length;
        best_number.consider({ index, possibilities }, score);
      }

      if (shadings && this.shadings[index] === null) {
        const possibilities = this.shading_possibilities(
          index,
          (best_shading.value?.possibilities.length ?? Infinity) + 1,
        );
        const interesting =
          this.numbers[index] !== null ||
          [...this.neighbours(index)].some((neighbour) => this.circles[neighbour] === true);
        const score = interesting ? possibilities.length : (possibilities.length - 1) * this.size + 1;
        best_shading.consider({ index, possibilities }, score);
      }

      if (!this.check(index)) return early_return;

      if (best_number.value?.possibilities.length === 0 || best_shading.value?.possibilities.length === 0)
        return early_return;
    }

    if (best_number.value === null && best_shading.value === null) {
      solutions.push(this.clone());
      return early_return;
    }

    const min_score_so_far = Math.min(best_number.score, best_shading.score);
    let best_coordinate = new Best<{ number: number; possibilities: number[] }>(random);

    if (numbers && this.$explore_coordinates && min_score_so_far > 1) {
      (() => {
        for (const coord_type of ['row', 'col', 'box']) {
          for (let coord_index = 0; coord_index < this.size; ++coord_index) {
            for (let number = 1; number <= this.size; ++number) {
              const possibilities = this.coordinate_possibilities(
                { [coord_type]: coord_index },
                number,
                (best_coordinate.value?.possibilities.length ?? Infinity) + 1,
              );
              if (possibilities.length === 1 && this.numbers[possibilities[0]] === number) continue;
              const score = possibilities.length;

              best_coordinate.consider({ number, possibilities }, score);
              if (best_coordinate.score < min_score_so_far) return;
            }
          }
        }
      })();
    }

    const min_score = Math.min(best_number.score, best_shading.score, best_coordinate.score);
    const maybe_shuffle = random ? _.shuffle : <T>(a: T) => a;
    let steps = 1;

    if (best_number.score === min_score && best_number.value !== null) {
      for (const number of maybe_shuffle(best_number.value.possibilities)) {
        this.numbers[best_number.value.index] = number;
        const result = this.solve({
          solutions,
          solution_num,
          random,
          numbers,
          shadings,
          depth: depth - 1,
          max_steps: max_steps - steps,
        });
        this.numbers[best_number.value.index] = null;
        steps += result.steps;
        if (solutions.length >= solution_num) return { solutions, steps };
      }
    } else if (best_coordinate.score === min_score && best_coordinate.value !== null) {
      for (const index of maybe_shuffle(best_coordinate.value.possibilities)) {
        this.numbers[index] = best_coordinate.value.number;
        const result = this.solve({
          solutions,
          solution_num,
          random,
          numbers,
          shadings,
          depth: depth - 1,
          max_steps: max_steps - steps,
        });
        this.numbers[index] = null;
        steps += result.steps;
        if (solutions.length >= solution_num) return { solutions, steps };
      }
    } else if (best_shading.score === min_score && best_shading.value !== null) {
      for (const shading of maybe_shuffle(best_shading.value.possibilities)) {
        this.shadings[best_shading.value.index] = shading;
        const result = this.solve({
          solutions,
          solution_num,
          random,
          numbers,
          shadings,
          depth: depth - 1,
          max_steps: max_steps - steps,
        });
        this.shadings[best_shading.value.index] = null;
        steps += result.steps;
        if (solutions.length >= solution_num) return { solutions, steps };
      }
    }

    return { solutions, steps };
  }

  reduce({
    max_reduce = Infinity,
    numbers = true,
    shadings = true,
    max_steps = Infinity,
  }: { max_reduce?: number; numbers?: boolean; shadings?: boolean; max_steps?: number } = {}) {
    console.log();

    const required_numbers = Array.from(this.numbers, () => false);
    const required_shadings = Array.from(this.shadings, () => false);

    for (let reductions = 0; reductions < max_reduce; ++reductions) {
      process.stdout.write(`\rReductions: ${reductions} + 0 `);
      const options: { type: 'number' | 'shading'; index: number; score: number }[] = [];

      for (let index = 0; index < this.size * this.size; ++index) {
        if (numbers && this.numbers[index] !== null && !required_numbers[index]) {
          const number_possibilities = this.number_possibilities(index);
          const score = number_possibilities.length;
          options.push({ type: 'number', index, score });
        }
        if (shadings && this.shadings[index] !== null && !required_shadings[index]) {
          const shading_possibilities = this.shading_possibilities(index);
          const score = (shading_possibilities.length - 1) * this.size + 1;
          options.push({ type: 'shading', index, score });
        }
      }

      options.sort((a, b) => a.score - b.score);
      const reduced = (() => {
        let step = 0;
        for (const option of options) {
          process.stdout.write(`\rReductions: ${reductions} + ${++step}`);
          if (option.type === 'number') {
            const is_number_needed = this.is_number_needed(option.index, max_steps);
            if (is_number_needed === true) {
              required_numbers[option.index] = true;
            } else if (is_number_needed === false) {
              this.numbers[option.index] = null;
              return true;
            }
          } else if (option.type === 'shading') {
            const is_shading_needed = this.is_shading_needed(option.index, max_steps);
            if (is_shading_needed === true) {
              required_shadings[option.index] = true;
            } else if (is_shading_needed === false) {
              this.shadings[option.index] = null;
              return true;
            }
          }
        }
        return false;
      })();
      if (!reduced) break;
    }

    console.log();
  }

  is_number_needed(index: number, max_steps = Infinity) {
    const possibilities = this.number_possibilities(index, 2);
    if (possibilities.length === 1) {
      return false;
    }
    const original_number = this.numbers[index];
    const solutions: Solutions = [];
    for (let number = 1; number <= this.size; ++number) {
      if (number === original_number) continue;
      this.numbers[index] = number;
      this.solve({ solutions, solution_num: 1, max_steps });
      if (solutions.incomplete) break;
    }
    this.numbers[index] = original_number;
    return solutions.incomplete || solutions.length > 0;
  }

  is_shading_needed(index: number, max_steps = Infinity) {
    const possibilities = this.shading_possibilities(index, 2);
    if (possibilities.length === 1) {
      return false;
    }
    const original_shading = this.shadings[index];
    const solutions: Solutions = [];
    for (const shading of [true, false]) {
      if (shading === original_shading) continue;
      this.shadings[index] = shading;
      this.solve({ solutions, solution_num: 1, max_steps });
      if (solutions.incomplete) break;
    }
    this.shadings[index] = original_shading;
    return solutions.incomplete || solutions.length > 0;
  }

  check(index: number) {
    const shading = this.shadings[index];
    const number = this.numbers[index];
    const circle = this.circles[index];
    const coords = this.get_coordinates(index);

    // Circles can't be shaded
    if (circle === true && shading === true) {
      return false;
    }

    // Check shading inequalities
    if (number !== null && shading !== null) {
      for (const neighbour_index of this.neighbours(index)) {
        const neighbour_number = this.numbers[neighbour_index];
        const neighbour_shading = this.shadings[neighbour_index];
        // Neighbour must have number and shadings must be different for rules to apply
        if (neighbour_number === null || neighbour_shading === null || neighbour_shading === shading) continue;
        // Numbers in shaded cells are greater than their unshaded neighbours, and vice versa
        if (number > neighbour_number !== shading) {
          return false;
        }
      }
    }

    // Check sudoku rules
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

    const explore = (index: number, explore_null: boolean, explored: boolean[] = []) => {
      explored[index] = true;
      let explored_num = 1;

      for (const neighbour_index of this.neighbours(index)) {
        const shading = this.shadings[neighbour_index];
        if (shading === false || (!explore_null && shading === null) || explored[neighbour_index]) continue;
        explored_num += explore(neighbour_index, explore_null, explored);
      }
      return explored_num;
    };

    // Check circle shading conditions
    if (number !== null && circle === true) {
      // TODO: Understand how other circles touching the explored region have an impact on its size
      if (explore(index, false) - 1 > number) return false;
      if (explore(index, true) - 1 < number) return false;
    }

    const find_circles = (index: number, explored: boolean[] = [], circles: number[] = []) => {
      explored[index] = true;
      for (const neighbour_index of this.neighbours(index)) {
        if (explored[neighbour_index]) continue;
        const circle = this.circles[neighbour_index];
        const shading = this.shadings[neighbour_index];
        if (circle === true) {
          circles.push(neighbour_index);
          continue;
        } else if (shading !== true) {
          continue;
        }
        find_circles(neighbour_index, explored, circles);
      }
      return circles;
    };

    // Check that this shading doesn't ruin any circle conditions
    if (circle !== true && shading !== null) {
      const circles = find_circles(index);
      for (const circle_index of circles) {
        if (!this.check(circle_index)) return false;
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

  shading_possibilities(index: number, possibility_num = Infinity) {
    const original = this.shadings[index];
    const possibilities: boolean[] = [];

    for (const shading of [true, false]) {
      this.shadings[index] = shading;
      if (this.check(index)) {
        possibilities.push(shading);
      }
      if (possibilities.length >= possibility_num) break;
    }

    this.shadings[index] = original;
    return possibilities;
  }

  coordinate_possibilities(
    coords: { row?: number; col?: number; box?: number },
    number: number,
    possibility_num = Infinity,
  ) {
    const possibilities: number[] = [];

    for (let index = 0; index < this.numbers.length; ++index) {
      const original_number = this.numbers[index];
      if (original_number !== null && original_number !== number) continue;

      const this_coords = this.get_coordinates(index);
      if (this_coords.row !== coords.row && this_coords.col !== coords.col && this_coords.box !== coords.box) continue;

      // Assume that the grid is valid, and that this number has already been placed
      if (original_number === number) return [index];

      this.numbers[index] = number;
      if (this.check(index)) {
        possibilities.push(index);
      }
      this.numbers[index] = original_number;

      if (possibilities.length >= possibility_num) break;
    }

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
      if (this.circles[index]) {
        process.stdout.write('\u001b[4m');
      }
      process.stdout.write(this.numbers[index]?.toString() ?? '-');
      if (this.shadings[index] !== null || this.circles[index]) {
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
    return new Puzzle(this.size, this.box_width, this.box_height, this.numbers, this.shadings, this.circles);
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

const t = true;
const f = false;
const n = null;

const solve_basic = () => {
  const puzzle = new Puzzle(
    9,
    3,
    3,
    // prettier-ignore
    [
      0, 0, 0, 0, 6, 0, 0, 2, 0,
      0, 0, 7, 0, 2, 9, 0, 0, 0,
      4, 0, 0, 0, 0, 1, 7, 3, 0,
      0, 0, 0, 0, 0, 0, 0, 8, 0,
      0, 5, 0, 8, 7, 0, 3, 0, 0,
      0, 0, 9, 0, 0, 6, 0, 0, 0,
      0, 0, 4, 7, 0, 0, 0, 0, 0,
      9, 0, 5, 0, 0, 0, 0, 0, 0,
      6, 0, 0, 0, 5, 8, 0, 0, 1,
    ],
  );

  console.log('explore basic');
  puzzle.$explore_coordinates = false;
  time(() => puzzle.solve({ solution_num: 2, random: true }), 10);

  console.log('explore complex');
  puzzle.$explore_coordinates = true;
  const result = time(() => puzzle.solve({ solution_num: 2, random: true, shadings: false }), 10);

  console.log('solutions:', result.solutions.length);
  puzzle.print();
  result.solutions[0].print();
};

const solve_fortress = () => {
  const puzzle = new Puzzle(
    9,
    3,
    3,
    // prettier-ignore
    [
      0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 1, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 3, 0, 0,
      0, 3, 0, 0, 0, 0, 0, 0, 7,
      0, 0, 4, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 7, 0, 5, 6, 0, 8,
      0, 0, 0, 0, 0, 0, 0, 6, 0,
      0, 5, 0, 0, 1, 9, 0, 0, 0,
      0, 0, 2, 0, 0, 7, 0, 5, 0,
    ],
    // prettier-ignore
    [
      t, t, f, t, f, n, f, t, n,
      f, t, n, f, n, n, t, n, n,
      f, t, t, f, t, f, n, t, n,
      n, t, n, f, n, f, f, f, f,
      t, n, n, n, t, t, n, f, f,
      f, n, t, n, n, n, n, t, n,
      n, n, t, t, f, t, t, n, n,
      n, n, f, n, n, n, f, t, t,
      f, n, n, n, n, n, f, n, f,
    ],
  );

  console.log('solving big fortress (complex, early stop)');
  puzzle.$explore_coordinates = true;
  time(() => puzzle.solve({ solution_num: 1 }));
  console.log('solving big fortress (basic, early stop)');
  puzzle.$explore_coordinates = false;
  time(() => puzzle.solve({ solution_num: 1 }));
  console.log('solving big fortress (complex, exhaustive)');
  puzzle.$explore_coordinates = true;
  time(() => puzzle.solve({ solution_num: 2 }));
  console.log('solving big fortress (basic, exhaustive)');
  puzzle.$explore_coordinates = false;
  const result = time(() => puzzle.solve({ solution_num: 2 }));

  result.solutions[0].print();
};

const generate = () => {
  console.log('generating new puzzle');
  const empty_puzzle = new Puzzle(
    9,
    3,
    3,
    [],
    // prettier-ignore
    [
      t, f, f, t, f, t, f, f, t,
      f, t, t, f, t, f, t, t, f,
      f, t, t, f, t, f, t, t, f,
      t, f, f, t, t, t, f, f, t,
      f, t, t, t, f, t, t, t, f,
      t, f, f, t, t, t, f, f, t,
      f, t, t, f, t, f, t, t, f,
      f, t, t, f, t, f, t, t, f,
      t, f, f, t, f, t, f, f, t,
    ],
  );
  empty_puzzle.print();
  let new_solve = (() => {
    while (true) {
      const result = empty_puzzle.solve({ solution_num: 1, random: true, max_steps: 5000 });
      console.log('steps taken:', result.steps);
      if (result.solutions.length > 0) {
        return result;
      }
    }
  })();

  new_solve.solutions[0].print();

  return time(() => {
    console.log('reducing...');
    const new_puzzle = new_solve.solutions[0].clone();
    new_puzzle.reduce({ shadings: false, max_steps: 5000 });
    new_puzzle.print();

    console.log('solving...');
    const result = time(() => new_puzzle.solve({ solution_num: 2 }));

    // Check correctness
    if (result.solutions.length === 0) {
      throw new Error('UNSOLVABLE');
    }
    result.solutions[0].print();
    if (result.solutions.length > 1) {
      console.log('non-unique:');
      result.solutions[1].print();
      throw new Error('NON UNIQUE');
    }

    return new_puzzle;
  });
};

const generate_sudokurotto = () => {
  const empty_puzzle = new Puzzle(
    9,
    3,
    3,
    // prettier-ignore
    [],
    // prettier-ignore
    [],
    // prettier-ignore
    [
      f, t, f, f, f, f, f, t, f,
      t, f, f, f, f, f, f, f, t,
      f, f, f, f, f, f, f, f, f,
      f, f, f, f, f, f, f, f, f,
      f, f, f, f, t, f, f, f, f,
      f, f, f, f, f, f, f, f, f,
      f, f, f, f, f, f, f, f, f,
      t, f, f, f, f, f, f, f, t,
      f, t, f, f, f, f, f, t, f,
    ],
  );
  while (true) {
    const result = empty_puzzle.solve({ random: true, solution_num: 1, max_steps: 20000 });
    console.log('steps:', result.steps);
    if (result.solutions.length > 0) {
      result.solutions[0].print();
      break;
    }
  }
};

const puzzle = generate_sudokurotto();
