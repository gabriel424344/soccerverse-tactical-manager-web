
/* Soccerverse Tactical Manager - Tactical Engine v1 */
(function (global) {
'use strict';

const strategies = [
{ name:"Posse controlada", formation:"4-3-3", attack:1.04, defence:1.02, risk:.52, tempo:"Normal", style:"Posse de bola" },
{ name:"Equilibrio dinamico", formation:"4-2-3-1", attack:1.02, defence:1.06, risk:.48, tempo:"Normal", style:"Passes mistos" },
{ name:"Contra-ataque", formation:"4-4-2", attack:1.08, defence:.99, risk:.57, tempo:"Rapido", style:"Contra-ataque" },
{ name:"Pressao alta", formation:"3-5-2", attack:1.12, defence:.94, risk:.72, tempo:"Rapido", style:"Pressao alta" },
{ name:"Defesa compacta", formation:"4-5-1", attack:.91, defence:1.15, risk:.34, tempo:"Normal", style:"Bloco compacto" },
{ name:"Jogo pelos lados", formation:"4-4-2", attack:1.06, defence:.99, risk:.55, tempo:"Normal", style:"Jogo pelas alas" }
];

function simulate(input, strategy, random) {
 let goals=0, conceded=0;
 const gap=(input.ownStrength-input.opponentStrength)/25;
 const home=input.home ? .10 : -.04;

 for(let minute=1; minute<=90; minute++){
  let risk=strategy.risk;
  let attack=strategy.attack;
  let defence=strategy.defence;

  if(minute>=50 && goals<conceded){
   risk=.82; attack*=1.09; defence*=.96;
  } else if(minute>=70 && goals===conceded){
   risk=.78; attack*=1.07;
  } else if(minute>=70 && goals>conceded){
   risk=.22; defence*=1.09;
  }

  const fatigue=minute>48 ? Math.min(.16,(minute-48)/42*.10) : 0;
  const ownAttack=(input.ownAttack/65)*(.90+gap*.12)*attack;
  const oppAttack=(input.opponentAttack/65)*(1-gap*.08);

  const ownChance=Math.max(.004,Math.min(.12,
   (.025+ownAttack*.014+home*.035)*(.78+risk*.38)));

  const oppChance=Math.max(.004,Math.min(.12,
   (.024+oppAttack*.014)*(1-defence*.12+fatigue)));

  if(random()<ownChance && random()<.16) goals++;
  if(random()<oppChance && random()<.16) conceded++;
 }

 return goals>conceded ? "W" : goals===conceded ? "D" : "L";
}

function run(input, options={}) {
 const simulations=options.simulationsPerStrategy || 10000;

 const context={
  ownStrength:input.ownStrength,
  opponentStrength:input.opponentStrength,
  ownAttack:input.ownAttack || input.ownStrength,
  opponentAttack:input.opponentAttack || input.opponentStrength,
  home:input.home !== false
 };

 const results=strategies.map(strategy=>{
  let wins=0, draws=0, losses=0;

  for(let i=0;i<simulations;i++){
   const result=simulate(context,strategy,Math.random);
   if(result==="W") wins++;
   else if(result==="D") draws++;
   else losses++;
  }

  return {
   ...strategy,
   simulations,
   winProbability:wins/simulations*100,
   drawProbability:draws/simulations*100,
   lossProbability:losses/simulations*100
  };
 });

 results.sort((a,b)=>b.winProbability-a.winProbability);

 return {
  objective:"maximize_win_probability",
  totalSimulations:simulations*strategies.length,
  best:results[0],
  alternatives:results,
  disclaimer:"Modelo experimental, nao oficial."
 };
}

global.SoccerverseTacticalEngine={run,strategies};
})(window);
