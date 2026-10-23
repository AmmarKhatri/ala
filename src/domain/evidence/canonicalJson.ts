import { createHash } from "node:crypto";
import { z } from "zod";
import { InvalidRequestError } from "../errors/alaError.js";

export function canonicalJson(input: unknown): string {
  let value: z.infer<ReturnType<typeof z.json>>;
  try {
    JSON.stringify(input);
    value = z.json().parse(input);
  } catch {
    throw new InvalidRequestError({
      message: "Canonical JSON requires finite, acyclic JSON values.",
    });
  }
  const encode = (item: typeof value): string => {
    if (Array.isArray(item)) return `[${item.map(encode).join(",")}]`;
    if (item !== null && typeof item === "object")
      return `{${Object.keys(item)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${encode(item[key])}`)
        .join(",")}}`;
    return JSON.stringify(item);
  };
  return encode(value);
}

export function jsonDigest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
