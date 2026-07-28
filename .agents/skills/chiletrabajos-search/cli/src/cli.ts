import { createCLI } from "@bunli/core"
import { search } from "./commands/search.js"
import { detail } from "./commands/detail.js"

const cli = await createCLI({
  name: "chiletrabajos-cli",
  version: "0.1.0",
  description: "CLI for searching Informática / Telecomunicaciones jobs on Chiletrabajos.cl — Chile market",
})

cli.command(search)
cli.command(detail)

await cli.run()
