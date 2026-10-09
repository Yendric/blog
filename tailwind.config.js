/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*", "./content/**/*", "./islands/**/*.{tsx,jsx}"],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};
