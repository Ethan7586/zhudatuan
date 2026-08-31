export class OidcMapper {
  claims(value: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> {
    return Object.freeze(
      Object.fromEntries(
        [
          ['displayname', value.name],
          ['email', value.email],
          ['phone', value.phone_number],
        ].filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length <= 255)
      )
    );
  }
}
