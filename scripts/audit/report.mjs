export function report(name, violations) {
  const unique = [...new Map(violations.map((value) => [`${value.code}\u0000${value.location}\u0000${value.detail}`, value])).values()];
  console.log(`${name} accepted=${unique.length === 0} violations=${unique.length}`);
  for (const value of unique) console.log(`${value.code} ${value.location} ${value.detail}`.trim());
  if (unique.length > 0) process.exitCode = 1;
}
