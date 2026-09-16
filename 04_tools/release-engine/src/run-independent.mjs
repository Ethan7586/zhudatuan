export async function runIndependent(tasks) {
  const results = await Promise.allSettled(tasks.map((task) => task()));
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) throw failed.reason;
  return results.map((result) => result.value);
}
