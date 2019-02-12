const { getExampleValue } = require(`../example-value`)
const { TypeConflictReporter } = require(`../type-conflict-reporter`)

const INVALID_VALUE = undefined

// NOTE: Previously `data-tree-utils-test.js`
describe(`Get example value for type inference`, () => {
  const typeConflictReporter = new TypeConflictReporter()

  afterEach(() => {
    typeConflictReporter.clearConflicts()
  })

  const nodes = [
    {
      name: `The Mad Max`,
      hair: 1,
      date: `2006-07-22T22:39:53.000Z`,
      "key-with..unsupported-values": true,
      emptyArray: [],
      anArray: [1, 2, 3, 4],
      nestedArrays: [[1, 2, 3], [4, 5, 6]],
      objectsInArray: [{ field1: true }, { field2: 1 }],
      frontmatter: {
        date: `2006-07-22T22:39:53.000Z`,
        title: `The world of dash and adventure`,
        blue: 100,
      },
      context: {
        nestedObject: null,
      },
    },
    {
      name: `The Mad Wax`,
      hair: 2,
      date: `2006-07-22T22:39:53.000Z`,
      emptyArray: [undefined, null],
      anArray: [1, 2, 5, 4],
      iAmNull: null,
      nestedArrays: [[1, 2, 3]],
      objectsInArray: [{ field3: `foo` }],
      frontmatter: {
        date: `2006-07-22T22:39:53.000Z`,
        title: `The world of slash and adventure`,
        blue: 10010,
        circle: `happy`,
        draft: false,
      },
      context: {
        nestedObject: {
          someOtherProperty: 1,
        },
      },
    },
    {
      name: `The Mad Wax`,
      hair: 3,
      date: `2006-07-22T22:39:53.000Z`,
      anArray: [],
      iAmNull: null,
      frontmatter: {
        date: `2006-07-22T22:39:53.000Z`,
        title: `The world of slash and adventure`,
        blue: 10010,
        circle: `happy`,
        draft: false,
      },
      context: {
        nestedObject: {
          someOtherProperty: 2,
        },
      },
    },
    {
      name: `The Mad Wax`,
      hair: 4,
      date: `2006-07-22T22:39:53.000Z`,
      anArray: [4, 6, 2],
      iAmNull: null,
      frontmatter: {
        date: `2006-07-22T22:39:53.000Z`,
        title: `The world of slash and adventure`,
        blue: 10010,
        circle: `happy`,
        draft: false,
      },
      context: {
        nestedObject: {
          name: `Inner name`,
          someOtherProperty: 3,
        },
      },
      "": ``,
    },
  ]

  it(`builds field examples from an array of nodes`, () => {
    expect(getExampleValue({ nodes, typeConflictReporter })).toMatchSnapshot()
  })

  it(`skips null fields`, () => {
    expect(
      getExampleValue({ nodes, typeConflictReporter }).iAmNull
    ).not.toBeDefined()
  })

  it(`skips fields with key set to empty string`, () => {
    expect(
      getExampleValue({ nodes, typeConflictReporter })[``]
    ).not.toBeDefined()
  })

  it(`should not mutate the nodes`, () => {
    getExampleValue({ nodes, typeConflictReporter })
    expect(nodes[0].context.nestedObject).toBeNull()
    expect(nodes[1].context.nestedObject.someOtherProperty).toEqual(1)
    expect(nodes[2].context.nestedObject.someOtherProperty).toEqual(2)
    expect(nodes[3].context.nestedObject.someOtherProperty).toEqual(3)
  })

  it(`skips empty or sparse arrays`, () => {
    expect(
      getExampleValue({ nodes, typeConflictReporter }).emptyArray
    ).not.toBeDefined()
    expect(getExampleValue({ nodes, typeConflictReporter }).hair).toBeDefined()
  })

  it(`skips ignoredFields at the top level`, () => {
    const example = getExampleValue({
      nodes,
      typeConflictReporter,
      ignoreFields: [`name`, `anArray`],
    })

    expect(example.name).not.toBeDefined()
    expect(example.anArray).not.toBeDefined()
    expect(example.hair).toBeDefined()
    expect(example.context.nestedObject.name).toBeDefined()
  })

  it(`build enum values for fields from array on nodes`, () => {
    // TODO: Should be moved to `types/__tests__/sort.js`
    const { SchemaComposer } = require(`graphql-compose`)
    const { addInferredFields } = require(`../add-inferred-fields`)
    const { getFieldsEnum } = require(`../../types/sort`)

    const sc = new SchemaComposer()
    const tc = sc.createTC(`Fields`)
    addInferredFields({
      schemaComposer: sc,
      typeComposer: tc,
      exampleValue: getExampleValue({ nodes, typeConflictReporter }),
    })

    const fields = getFieldsEnum({
      schemaComposer: sc,
      typeComposer: tc,
      inputTypeComposer: tc.getITC(),
    })
      .getType()
      .getValues()
      .reduce((acc, { name, value }) => {
        acc[name] = { field: value }
        return acc
      }, {})

    expect(fields).toMatchSnapshot()
  })

  it(`turns polymorphic fields null`, () => {
    let example = getExampleValue({
      nodes: [{ foo: null }, { foo: [1] }, { foo: { field: 1 } }],
      typeConflictReporter,
    })
    expect(example.foo).toBe(INVALID_VALUE)
  })

  it(`handles polymorphic arrays`, () => {
    let example = getExampleValue({
      nodes: [{ foo: [[`foo`, `bar`]] }, { foo: [{ field: 1 }] }],
      typeConflictReporter,
    })
    expect(example.foo).toBe(INVALID_VALUE)
  })

  it(`doesn't confuse empty fields for polymorhpic ones`, () => {
    let example = getExampleValue({
      nodes: [{ foo: { bar: 1 } }, { foo: null }, { foo: { field: 1 } }],
      typeConflictReporter,
    })
    expect(example.foo).toEqual({ field: 1, bar: 1 })

    example = getExampleValue({
      nodes: [
        { foo: [{ bar: 1 }] },
        { foo: null },
        { foo: [{ field: 1 }, { baz: 1 }] },
      ],
      typeConflictReporter,
    })
    expect(example.foo).toEqual([{ field: 1, bar: 1, baz: 1 }])
  })

  it(`skips unsupported types`, () => {
    // Skips functions
    let example = getExampleValue({
      nodes: [{ foo: () => {} }],
      typeConflictReporter,
    })
    expect(example.foo).not.toBeDefined()

    // Skips array of functions
    example = getExampleValue({
      nodes: [{ foo: [() => {}] }],
      typeConflictReporter,
    })
    expect(example.foo).not.toBeDefined()
  })

  it(`prefers float when multiple number types`, () => {
    let example

    // nodes starting with 32-bit integer ("big" ints are float)
    example = getExampleValue({
      nodes: [{ number: 5 }, { number: 2.5 }],
      typeConflictReporter,
    })
    expect(example.number).toBeDefined()
    expect(example.number).toEqual(2.5)
    example = getExampleValue({
      nodes: [{ number: 5 }, { number: 3000000000 }],
      typeConflictReporter,
    })
    expect(example.number).toBeDefined()
    expect(example.number).toEqual(3000000000)

    // with node not containing number field
    example = getExampleValue({
      nodes: [{ number: 5 }, {}, { number: 2.5 }],
      typeConflictReporter,
    })
    expect(example.number).toBeDefined()
    expect(example.number).toEqual(2.5)

    // nodes starting with float ("big" ints are float)
    example = getExampleValue({
      nodes: [{ number: 2.5 }, { number: 5 }],
      typeConflictReporter,
    })
    expect(example.number).toBeDefined()
    expect(example.number).toEqual(2.5)
    example = getExampleValue({
      nodes: [{ number: 3000000000 }, { number: 5 }],
      typeConflictReporter,
    })
    expect(example.number).toBeDefined()
    expect(example.number).toEqual(3000000000)

    // array of numbers - starting with float
    example = getExampleValue({
      nodes: [{ numbers: [2.5, 5] }],
      typeConflictReporter,
    })
    expect(example.numbers).toBeDefined()
    expect(Array.isArray(example.numbers)).toBe(true)
    expect(example.numbers.length).toBe(1)
    expect(example.numbers[0]).toBe(2.5)
    example = getExampleValue({
      nodes: [{ numbers: [3000000000, 5] }],
      typeConflictReporter,
    })
    expect(example.numbers).toBeDefined()
    expect(Array.isArray(example.numbers)).toBe(true)
    expect(example.numbers.length).toBe(1)
    expect(example.numbers[0]).toBe(3000000000)

    // array of numbers - starting with 32-bit integer
    example = getExampleValue({
      nodes: [{ numbers: [5, 2.5] }],
      typeConflictReporter,
    })
    expect(example.numbers).toBeDefined()
    expect(Array.isArray(example.numbers)).toBe(true)
    expect(example.numbers.length).toBe(1)
    expect(example.numbers[0]).toBe(2.5)
    example = getExampleValue({
      nodes: [{ numbers: [5, 3000000000] }],
      typeConflictReporter,
    })
    expect(example.numbers).toBeDefined()
    expect(Array.isArray(example.numbers)).toBe(true)
    expect(example.numbers.length).toBe(1)
    expect(example.numbers[0]).toBe(3000000000)
  })

  it(`handles mix of date strings and date objects`, () => {
    let example

    // should be valid
    example = getExampleValue({
      nodes: [
        { date: new Date(`2017-12-01T14:59:45.600Z`) },
        { date: `2017-01-12T18:13:38.326Z` },
      ],
      typeConflictReporter,
    })
    expect(example.date).not.toBe(INVALID_VALUE)

    // should be invalid (string is not a date)
    example = getExampleValue({
      nodes: [
        { date: new Date(`2017-12-01T14:59:45.600Z`) },
        { date: `This is not a date!!!!!!` },
      ],
      typeConflictReporter,
    })
    expect(example.date).toBe(INVALID_VALUE)

    // should be valid - reversed order
    example = getExampleValue({
      nodes: [
        { date: `2017-01-12T18:13:38.326Z` },
        { date: new Date(`2017-12-01T14:59:45.600Z`) },
      ],
      typeConflictReporter,
    })
    expect(example.date).not.toBe(INVALID_VALUE)

    // should be invalid (string is not a date) - reversed order
    example = getExampleValue({
      nodes: [
        { date: `This is not a date!!!!!!` },
        { date: new Date(`2017-12-01T14:59:45.600Z`) },
      ],
      typeConflictReporter,
    })
    expect(example.date).toBe(INVALID_VALUE)
  })

  it(`handles arrays with mix of date strings and date objects`, () => {
    let example

    // should be valid - separate arrays of unique types
    example = getExampleValue({
      nodes: [
        { dates: [new Date(`2017-12-01T14:59:45.600Z`)] },
        { dates: [`2017-01-12T18:13:38.326Z`] },
      ],
      typeConflictReporter,
    })
    expect(example.dates).not.toBe(INVALID_VALUE)

    // should be invalid - separate arrays of unique types (string is not a date)
    example = getExampleValue({
      nodes: [
        { dates: [new Date(`2017-12-01T14:59:45.600Z`)] },
        { dates: [`This is not a date!!!!!!`] },
      ],
      typeConflictReporter,
    })
    expect(example.dates).toBe(INVALID_VALUE)

    // should be valid - single array of mixed types
    example = getExampleValue({
      nodes: [
        {
          dates: [
            new Date(`2017-12-01T14:59:45.600Z`),
            `2017-01-12T18:13:38.326Z`,
          ],
        },
      ],
      typeConflictReporter,
    })
    expect(example.dates).not.toBe(INVALID_VALUE)

    // should be invalid - single array of mixed types (string is not a date)
    example = getExampleValue({
      nodes: [
        {
          dates: [
            new Date(`2017-12-01T14:59:45.600Z`),
            `This is not a date!!!!!!`,
          ],
        },
      ],
      typeConflictReporter,
    })
    expect(example.dates).toBe(INVALID_VALUE)

    // should be valid - separate arrays of both unique types and mixed types
    example = getExampleValue({
      nodes: [
        {
          dates: [
            new Date(`2017-12-01T14:59:45.600Z`),
            `2017-01-12T18:13:38.326Z`,
          ],
        },
        { dates: [new Date(`2017-12-01T14:59:45.600Z`)] },
        { dates: [`2017-01-12T18:13:38.326Z`] },
      ],
      typeConflictReporter,
    })
    expect(example.dates).not.toBe(INVALID_VALUE)

    // should be valid - separate arrays of both unique types and mixed types (string is not a date) #1
    example = getExampleValue({
      nodes: [
        {
          dates: [
            new Date(`2017-12-01T14:59:45.600Z`),
            `This is not a date!!!!!!`,
          ],
        },
        { dates: [new Date(`2017-12-01T14:59:45.600Z`)] },
        { dates: [`2017-01-12T18:13:38.326Z`] },
      ],
      typeConflictReporter,
    })
    expect(example.dates).toBe(INVALID_VALUE)

    // should be valid - separate arrays of both unique types and mixed types (string is not a date) #2
    example = getExampleValue({
      nodes: [
        {
          dates: [
            new Date(`2017-12-01T14:59:45.600Z`),
            `2017-01-12T18:13:38.326Z`,
          ],
        },
        { dates: [new Date(`2017-12-01T14:59:45.600Z`)] },
        { dates: [`This is not a date!!!!!!`] },
      ],
      typeConflictReporter,
    })
    expect(example.dates).toBe(INVALID_VALUE)

    // should be valid - separate arrays of both unique types and mixed types (string is not a date) #2
    example = getExampleValue({
      nodes: [
        {
          dates: [
            new Date(`2017-12-01T14:59:45.600Z`),
            `This is not a date!!!!!!`,
          ],
        },
        { dates: [new Date(`2017-12-01T14:59:45.600Z`)] },
        { dates: [`This is not a date!!!!!!`] },
      ],
      typeConflictReporter,
    })
    expect(example.dates).toBe(INVALID_VALUE)
  })
})

describe(`Type conflicts`, () => {
  it(`Doesn't report conflicts if there are none`, () => {
    const typeConflictReporter = new TypeConflictReporter()
    const nodes = [
      {
        id: `id1`,
        string: `string`,
        number: 5,
        boolean: true,
        arrayOfStrings: [`string1`],
      },
      {
        id: `id2`,
        string: `other string`,
        number: 3.5,
        boolean: false,
        arrayOfStrings: null,
      },
    ]

    getExampleValue({ nodes, typeName: `NoConflict`, typeConflictReporter })

    expect(typeConflictReporter.getConflicts()).toEqual([])
  })

  it(`Report type conflicts and its origin`, () => {
    const typeConflictReporter = new TypeConflictReporter()

    const nodes = [
      {
        id: `id1`,
        stringOrNumber: `string`,
        number: 5,
        boolean: true,
        arrayOfStrings: [`string1`],
      },
      {
        id: `id2`,
        stringOrNumber: 5,
        number: 3.5,
        boolean: false,
        arrayOfStrings: null,
      },
    ]

    getExampleValue({ nodes, typeName: `Conflict_1`, typeConflictReporter })

    expect(typeConflictReporter.getConflicts()).toMatchSnapshot()
  })

  it(`Report conflict when array has mixed types and its origin`, () => {
    const nodes = [
      {
        id: `id1`,
        arrayOfMixedType: [`string1`, 5, `string2`, true],
      },
    ]
    const typeConflictReporter = new TypeConflictReporter()

    getExampleValue({ nodes, typeName: `Conflict_2`, typeConflictReporter })
    expect(typeConflictReporter.getConflicts()).toMatchSnapshot()
  })

  it(`Doesn't report ignored fields`, () => {
    const typeConflictReporter = new TypeConflictReporter()

    const nodes = [
      {
        id: `id1`,
        stringOrNumber: `string`,
        other: 1,
      },
      {
        id: `id2`,
        stringOrNumber: 5,
        other: `foo`,
      },
    ]

    getExampleValue({
      nodes,
      typeName: `Conflict_3`,
      typeConflictReporter,
      ignoreFields: [`stringOrNumber`],
    })

    expect(typeConflictReporter.getConflicts()).toMatchSnapshot()
  })
})
