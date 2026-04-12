# Code of Conduct

## The new reality

Much of the work in this project — drafting, refactoring, testing, compiling — is done by AI coding harnesses. That changes what a code of conduct needs to say. The traditional framing assumes humans produce code and humans review it. Here, humans direct, curate, and are responsible for what the harnesses produce. The conduct expected of contributors is the conduct of a thoughtful author, not a lone craftsperson.

## On human conduct

Be direct. Be honest about what you know and what you don't. Disagree on substance, not identity. Don't make it personal and don't make it political. If a contribution is wrong or low quality, say so and explain why — that's more useful than silence or politeness that lets bad guidance propagate to thousands of AI sessions.

This is a knowledge project. The artifacts here get injected into AI context and shape how coding assistants behave. A poorly written skill isn't just a bad PR — it actively degrades the output of every user who installs it. Hold each other to that standard without being unpleasant about it.

## On AI-assisted contributions

You are responsible for everything you submit, regardless of which tool produced it. "The model wrote it" is not a defense for incorrect guidance, plagiarised content, or careless frontmatter. Review what the harness produces. Understand it. Own it.

That said: using AI assistance is not just acceptable here, it's expected. This is a bazaar for harness configurations — contributors who don't use harnesses to help build it are missing the point. The distinction that matters is not human-written vs. AI-written. It's *curated* vs. *uncurated*.

Curated means:
- You've read it and can explain what it does
- You've verified it against the domain it claims to cover
- You've run `forge validate` and `forge build` and they pass
- You'd stake your name on the advice it gives

Uncurated means: you generated it, skimmed it, and submitted it hoping no one would notice. That's the conduct this project does not want.

## On knowledge quality

AI coding assistants will follow the guidance in these artifacts. Write accordingly. Vague guidance produces vague behavior. Incorrect guidance produces incorrect behavior, at scale, silently. The standard for a contribution to this project is not "does it compile" — it's "does it make the harness measurably better at the task it describes."

If you're not sure whether a contribution clears that bar, it probably doesn't yet.

## On attribution

If you import content from an external source — another power library, a blog post, a book, a company's internal standards — say so in the artifact's author field and body. Don't pass off someone else's framework as original work.

AI-generated content does not require an AI attribution line. You are the author. The harness is a tool.

## On disagreement

The artifacts here encode opinions. Opinions can be wrong or outdated. If you disagree with guidance in an existing artifact, open an issue with a specific counter-argument, not a style complaint. "I would have written it differently" is not a reason to change working guidance. "This will cause the model to do X, which is wrong because Y" is.

## Enforcement

Contributions that submit unreviewed AI output, plagiarise, or are deliberately misleading will be closed without merge. Repeated offenses result in removal from the project.

Everything else is a conversation.

---

*This project uses AI harnesses to build tools for AI harnesses. Conduct yourself accordingly: with the judgment to know when to trust the machine and the integrity to correct it when it's wrong.*
