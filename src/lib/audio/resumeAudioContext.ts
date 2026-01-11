export async function resumeAudioContext(ctx: AudioContext, label = "audio") {
  let state: AudioContextState = ctx.state;
  if (state !== "suspended") return true;

  try {
    await ctx.resume();
    state = ctx.state;
    return state === "running";
  } catch (err) {
    console.warn(`[${label}] AudioContext resume failed`, err);
    return false;
  }
}
