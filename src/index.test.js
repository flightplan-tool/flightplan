const fp = require('./index')

for (const id of fp.supported()) {
  test(`Create engine ${id}`, () => {
    const engine = fp.new(id)
    expect(engine).toBeDefined()
    expect(engine.config).toBeInstanceOf(fp.Config)
  })
}
