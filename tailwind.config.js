/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*", "./content/**/*"],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};
