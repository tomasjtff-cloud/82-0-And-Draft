import { describe, expect, it } from "vitest";
import { shortName } from "@/lib/core/names";

describe("shortName", () => {
  it.each([
    ["Frenkie de Jong", "de Jong"], ["Ángel Di María", "Di María"], ["Virgil van Dijk", "van Dijk"], ["Kevin De Bruyne", "De Bruyne"],
    ["Robin van Persie", "van Persie"], ["Sergio Ramos", "Ramos"], ["Mohamed Salah", "Salah"], ["Cristiano Ronaldo", "Ronaldo"],
    ["Edwin van der Sar", "van der Sar"], ["Donny van de Beek", "van de Beek"], ["Marc-André ter Stegen", "ter Stegen"],
    ["Alessandro Del Piero", "Del Piero"], ["Alexis Mac Allister", "Mac Allister"], ["Vinícius Júnior", "Vinícius Jr."],
    ["Jaren Jackson Jr.", "Jackson Jr."], ["Gary Payton II", "Payton II"], ["Shaquille O'Neal", "O'Neal"], ["Karl-Anthony Towns", "Towns"],
    ["Ronaldinho", "Ronaldinho"], ["  Kaká ", "Kaká"], ["Stephan El Shaarawy", "El Shaarawy"], ["", ""],
  ])("%s → %s", (full, short) => expect(shortName(full)).toBe(short));
});
