// The prompt a visitor pastes into their agent. As it stands it sets jevable
// up (the guide takes it from there); a job put in front makes it that job.

export const SETUP = "Set up jevable: run `npx -y jevable guide` and follow it.";
const FOR_JOB = "Set it up with jevable: run `npx -y jevable guide` and follow it.";

export const prompt = (job: string) => (job.trim() ? `${job.trim()}\n${FOR_JOB}` : SETUP);

/** The prompt as HTML: the job on its own line, the command kept whole. */
export function promptHtml(job: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return esc(prompt(job))
    .replace(/^(.*)\n/, '<span class="need">$1</span>\n')
    .replace(/`[^`]+`/, (c) => `<span class="nb">${c}</span>`);
}
