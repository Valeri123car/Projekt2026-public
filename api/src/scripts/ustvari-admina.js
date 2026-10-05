// Ustvari prvega administratorja v prazni bazi (registracija prek API-ja je samo za admine).
// Uporaba (iz mape api/):
//   node --env-file=.env src/scripts/ustvari-admina.js <email> <geslo> [ime] [priimek]
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const [email, geslo, ime = "Admin", priimek = "Sirena"] = process.argv.slice(2);

if (!email || !geslo || geslo.length < 6) {
  console.error(
    "Uporaba: node --env-file=.env src/scripts/ustvari-admina.js <email> <geslo (min. 6 znakov)> [ime] [priimek]",
  );
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const obstaja = await prisma.uporabnik.findUnique({ where: { email } });
  if (obstaja) {
    console.error(`Uporabnik ${email} že obstaja (id ${obstaja.id_uporabnik}).`);
    process.exit(1);
  }

  const nov = await prisma.uporabnik.create({
    data: {
      ime,
      priimek,
      email,
      geslo: await bcrypt.hash(geslo, 12),
      dostop: 2,
      gdpr_soglasje: true,
      gdpr_datum: new Date(),
    },
  });

  console.log(`Administrator ustvarjen: ${nov.email} (id ${nov.id_uporabnik})`);
} finally {
  await prisma.$disconnect();
}
