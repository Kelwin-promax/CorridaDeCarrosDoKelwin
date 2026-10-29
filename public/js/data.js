// Dados do jogo: carros e pistas.
// "id" do carro é o caminho do .glb a partir de public/.
// "rot" corrige a frente de um modelo específico (ex.: Math.PI se ele andar de ré).
// spd / acc / ctl: velocidade, aceleração e controle (0 a 1).
export const CARS = [
  { id: 'NewCars/bugatti_chiron_mansory.glb',          brand: 'Bugatti',     name: 'Chiron Mansory',      spd: .98, acc: .88, ctl: .72, rot: Math.PI },
  { id: 'NewCars/bugatti_la_voiture_noire.glb',        brand: 'Bugatti',     name: 'La Voiture Noire',    spd: .97, acc: .84, ctl: .70 },
  { id: 'NewCars/bugatti_centodieci.glb',              brand: 'Bugatti',     name: 'Centodieci',          spd: .96, acc: .86, ctl: .74 },
  { id: 'NewCars/bugatti_divo.glb',                    brand: 'Bugatti',     name: 'Divo',                spd: .92, acc: .86, ctl: .86 },
  { id: 'NewCars/vision_1789.glb',                     brand: 'Concept',     name: 'Vision 1789',         spd: .92, acc: .86, ctl: .80 },
  { id: 'NewCars/mclaren_ultimate_vision_gt.glb',      brand: 'McLaren',     name: 'Ultimate Vision GT',  spd: .96, acc: .94, ctl: .88 },
  { id: 'NewCars/mclaren_solus_gt.glb',                brand: 'McLaren',     name: 'Solus GT',            spd: .92, acc: .90, ctl: .95 },
  { id: 'NewCars/2015_mclaren_650s_gt3.glb',           brand: 'McLaren',     name: '650S GT3',            spd: .80, acc: .80, ctl: .92 },
  { id: '3d_model_supercar_mclaren_765lt_vr_ready.glb', brand: 'McLaren',    name: '765LT',               spd: .84, acc: .88, ctl: .82 },
  { id: 'NewCars/koenigsegg_agera_rs.glb',             brand: 'Koenigsegg',  name: 'Agera RS',            spd: .95, acc: .90, ctl: .76 },
  { id: 'NewCars/koenigsegg_ccxr_edition.glb',         brand: 'Koenigsegg',  name: 'CCXR Edition',        spd: .90, acc: .86, ctl: .74, rot: Math.PI },
  { id: 'NewCars/koenigsegg_gemera_prototype.glb',     brand: 'Koenigsegg',  name: 'Gemera',              spd: .86, acc: .92, ctl: .76 },
  { id: 'NewCars/koenigsegg_ccgt_gtx_longtail_xs.glb', brand: 'Koenigsegg',  name: 'CCGT GTX Longtail',   spd: .86, acc: .82, ctl: .88 },
  { id: 'NewCars/lotus_evija.glb',                     brand: 'Lotus',       name: 'Evija',               spd: .88, acc: .98, ctl: .76 },
  { id: 'NewCars/peugeot_9x8.glb',                     brand: 'Peugeot',     name: '9X8',                 spd: .86, acc: .82, ctl: .92 },
  { id: 'NewCars/free_rossa_gt_lm_prototype_2023.glb', brand: 'Rossa',       name: 'GT LM Prototype',     spd: .88, acc: .82, ctl: .94 },
  { id: 'NewCars/lamborghini_aventador_lp_770-4_svj.glb', brand: 'Lamborghini', name: 'Aventador SVJ',    spd: .90, acc: .88, ctl: .80 },
  { id: 'lamborghini_v12_vision_gt.glb',               brand: 'Lamborghini', name: 'V12 Vision GT',       spd: .94, acc: .88, ctl: .74 },
  { id: 'lamborghini_revuelto.glb',                    brand: 'Lamborghini', name: 'Revuelto',            spd: .90, acc: .86, ctl: .78 },
  { id: '2019_lamborghini_sc18_alston.glb',            brand: 'Lamborghini', name: 'SC18 Alston',         spd: .86, acc: .84, ctl: .80 },
  { id: '2021_lamborghini_countach_lpi_800-4.glb',     brand: 'Lamborghini', name: 'Countach LPI 800-4',  spd: .84, acc: .82, ctl: .76, rot: Math.PI },
  { id: 'NewCars/ferrari_f8_tributo.glb',              brand: 'Ferrari',     name: 'F8 Tributo',          spd: .82, acc: .84, ctl: .82 },
  { id: '2026_ferrari_849_testarossa.glb',             brand: 'Ferrari',     name: '849 Testarossa',      spd: .88, acc: .86, ctl: .80 },
  { id: '2026_ferrari_296_speciale_a.glb',             brand: 'Ferrari',     name: '296 Speciale A',      spd: .82, acc: .86, ctl: .84 },
  { id: 'cavallo_458_speciale.glb',                    brand: 'Cavallo',     name: '458 Speciale',        spd: .76, acc: .78, ctl: .84, rot: Math.PI },
  { id: 'pagani_huayra_bc.glb',                        brand: 'Pagani',      name: 'Huayra BC',           spd: .88, acc: .84, ctl: .86 },
  { id: '3d_model_supercar_gt.glb',                    brand: 'Supercar',    name: 'GT',                  spd: .74, acc: .72, ctl: .78, rot: Math.PI, pca: true },
  { id: 'supercar_like_lamborghini.glb',               brand: 'Supercar',    name: 'Estilo Lamborghini',  spd: .70, acc: .70, ctl: .72 },
  { id: 'generic_supercar.glb',                        brand: 'Supercar',    name: 'Genérico',            spd: .66, acc: .68, ctl: .72 },
  { id: 'supercar.glb',                                brand: 'Supercar',    name: 'Clássico',            spd: .62, acc: .64, ctl: .70 },
];

// Pistas: modelos de public/RaceTracks e o traçado extraído por tools/track-centerline.js.
// "scale" leva as unidades do modelo para metros do jogo (pista com ~14 m de largura).
export const TRACKS = [
  { id: 'spa',    nome: 'Spa-Francorchamps', pais: 'Bélgica', ano: '1992', voltas: 2, scale: 0.21,
    file: 'RaceTracks/circuit_de_spa-francorchamps_1992_layout.glb', data: 'tracks/spa.json' },
  { id: 'motegi', nome: 'Motegi',            pais: 'Japão',   ano: 'Twin Ring', voltas: 2, scale: 0.00145,
    file: 'RaceTracks/mobility_resort_motegi_twin_ring.glb', data: 'tracks/motegi.json' },
  { id: 'hg',     nome: 'HG Circuit',        pais: 'Japão',   ano: 'Long', voltas: 4, scale: 0.95,
    file: 'RaceTracks/penny_racers_ps2_-_hg_circuit_long.glb', data: 'tracks/hg.json' },
];

export const SAMPLES = 1500;     // pontos do traçado usados na física (o servidor usa o mesmo valor)
export const CAR_LEN = 4.4;      // comprimento padrão dos carros na cena
export const CAR_RADIUS = 1.4;   // raio usado na colisão entre carros
// Se TODOS os carros aparecerem andando de ré, troque para Math.PI
export const CAR_FORWARD_OFFSET = 0;

export const carOf = id => CARS.find(c => c.id === id);
export const carName = id => { const c = carOf(id); return c ? `${c.brand} ${c.name}` : id; };
export const trackOf = id => TRACKS.find(t => t.id === id);
export const thumbOf = id => 'thumbs/' + id.split('/').pop().replace(/\.glb$/, '.webp');

// Índice de desempenho mostrado na garagem (estilo "rank") e estrelas / classe
export const ratingOf = c => Math.round((c.spd * 0.45 + c.acc * 0.35 + c.ctl * 0.2) * 4000);
export function tierOf(c) {
  const r = ratingOf(c);
  return r >= 3560 ? { cls: 'S', stars: 5 } : r >= 3400 ? { cls: 'A', stars: 4 } : r >= 3200 ? { cls: 'B', stars: 3 } : r >= 2900 ? { cls: 'C', stars: 2 } : { cls: 'D', stars: 1 };
}
