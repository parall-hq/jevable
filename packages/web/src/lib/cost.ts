// What Jev costs, from its price and the demo's real runs (src/data/demo.json).
import demo from "../data/demo.json";

/** Jev's price in US$ per input token; output is free (docs.typesafe.ai). */
export const JEV_PRICE = 0.042 / 1e6;

const questions = demo.reduce((n, c) => n + c.questions, 0);
const tokens = demo.reduce((n, c) => n + c.tokens, 0);

/** One question to Jev, on average, in the demo's runs. */
export const PER_QUESTION = (tokens / questions) * JEV_PRICE;
