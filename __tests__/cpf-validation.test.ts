import { describe, expect, it } from "vitest";
import { formatCpf, isValidCpfFormat, maskCpf, normalizeCpf } from "@/lib/validation/cpf";

describe("cpf validation helpers", () => {
  it("normalizes punctuation before persistence", () => {
    expect(normalizeCpf("123.456.789-01")).toBe("12345678901");
  });

  it("accepts cpf with or without punctuation", () => {
    expect(isValidCpfFormat("12345678901")).toBe(true);
    expect(isValidCpfFormat("123.456.789-01")).toBe(true);
    expect(isValidCpfFormat("123.456.789-0")).toBe(false);
  });

  it("formats cpf progressively for the form field", () => {
    expect(formatCpf("12345678901")).toBe("123.456.789-01");
    expect(formatCpf("1234567")).toBe("123.456.7");
  });

  it("masks cpf before exposing it outside auth boundaries", () => {
    expect(maskCpf("12345678901")).toBe("***.***.***-01");
  });
});
