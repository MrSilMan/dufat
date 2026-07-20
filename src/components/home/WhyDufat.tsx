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
    <section aria-labelledby="why-dufat" className="relative bg-paper py-24">
      {/* Soft blue mist rising to meet the hero above */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_50%_0%,rgba(45,119,201,0.1),transparent_70%)]"
      />
      <div className="container-site relative">
        <Reveal>
          <p className="eyebrow">Porquê a Dufat</p>
          <h2 id="why-dufat" className="mt-3 max-w-2xl text-3xl font-black text-ink md:text-5xl">
            O parceiro de iluminação das <span className="text-gradient-blue">cidades angolanas</span>
          </h2>
        </Reveal>

        {/* Stats live inside a pool of brand blue */}
        <Reveal className="mt-14">
          <div className="panel-brand p-8 md:p-10">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <CountUp
                    value={stat.value}
                    suffix={stat.suffix}
                    className="block font-display text-4xl font-black text-white md:text-5xl"
                  />
                  <p className="mt-2 text-sm text-dufat-mist">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal stagger="[data-pillar]" className="mt-12 grid gap-6 md:grid-cols-3">
          {pillars.map((pillar, index) => (
            <article key={pillar.title} data-pillar className="card-lift p-7">
              <p
                aria-hidden
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-lumen/20 font-mono text-xs font-semibold tracking-wide text-lumen-deep"
              >
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-4 text-lg font-bold text-ink">{pillar.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{pillar.body}</p>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
