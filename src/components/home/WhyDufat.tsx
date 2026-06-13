import { CountUp } from "@/components/motion/CountUp";
import { Reveal } from "@/components/motion/Reveal";

const stats = [
  { value: 12, suffix: "+", label: "Anos de experiência" },
  { value: 140, suffix: "+", label: "Projetos concluídos" },
  { value: 9, suffix: "", label: "Províncias servidas" },
  { value: 18000, suffix: "+", label: "Pontos de luz fornecidos" },
];

const pillars = [
  {
    title: "Stock local, entrega rápida",
    body: "Armazém em Luanda com luminárias, postes e acessórios prontos a levantar — sem esperar por importações.",
  },
  {
    title: "Especificação técnica",
    body: "Fichas técnicas completas, apoio ao dimensionamento luminotécnico e acompanhamento em obra.",
  },
  {
    title: "Eficiência energética",
    body: "LED 6500K com fator de potência >0,9: até 58% de poupança face ao vapor de sódio.",
  },
];

export function WhyDufat() {
  return (
    <section aria-labelledby="why-dufat" className="border-t border-night-line bg-night py-24">
      <div className="container-site">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-dufat-sky">Porquê a Dufat</p>
          <h2 id="why-dufat" className="mt-3 max-w-2xl text-3xl font-black md:text-5xl">
            O parceiro de iluminação das cidades angolanas
          </h2>
        </Reveal>

        <Reveal stagger="[data-stat]" className="mt-14 grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} data-stat className="card-night p-6 text-center">
              <CountUp
                value={stat.value}
                suffix={stat.suffix}
                className="block font-display text-4xl font-black text-dufat-sky md:text-5xl"
              />
              <p className="mt-2 text-sm text-white/65">{stat.label}</p>
            </div>
          ))}
        </Reveal>

        <Reveal stagger="[data-pillar]" className="mt-12 grid gap-6 md:grid-cols-3">
          {pillars.map((pillar) => (
            <article key={pillar.title} data-pillar className="rounded-2xl border border-night-line p-6">
              <h3 className="text-lg font-bold text-white">{pillar.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/65">{pillar.body}</p>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
