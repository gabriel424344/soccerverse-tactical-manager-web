
/* SOCCERVERSE TACTICAL MANAGER
   Integração com dados públicos oficiais
*/

(function (global) {
  "use strict";

  const API = "https://play.soccerverse.com";

  async function getJSON(url) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Erro HTTP " + response.status);
    }

    return response.json();
  }

  async function gsp(method, params) {
    const response = await fetch(API + "/v1/gsp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params
      })
    });

    if (!response.ok) {
      throw new Error("Erro GSP: " + response.status);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }

  function unwrap(value) {
    let result = value;

    for (let i = 0; i < 4; i++) {
      if (
        result &&
        typeof result === "object" &&
        !Array.isArray(result) &&
        result.data !== undefined
      ) {
        result = result.data;
      } else {
        break;
      }
    }

    return result;
  }

  function average(values) {
    const valid = values.filter(
      value => Number.isFinite(value) && value > 0
    );

    if (!valid.length) return null;

    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  function getPlayerStats(players) {
    const attack = [];
    const defence = [];
    const goalkeeping = [];
    const general = [];

    players.forEach(player => {
      const shooting = Number(player.ability_shooting);
      const passing = Number(player.ability_passing);
      const tackling = Number(player.ability_tackling);
      const goalkeeper = Number(player.ability_gk);

      if (shooting > 0) attack.push(shooting);
      if (passing > 0) attack.push(passing);
      if (tackling > 0) defence.push(tackling);
      if (goalkeeper > 0) goalkeeping.push(goalkeeper);

      const abilities = [
        shooting,
        passing,
        tackling,
        goalkeeper
      ].filter(v => Number.isFinite(v) && v > 0);

      if (abilities.length) {
        general.push(average(abilities));
      }
    });

    return {
      players: players.length,
      strength: average(general),
      attack: average(attack),
      defence: average(defence),
      goalkeeper: average(goalkeeping)
    };
  }

  async function getSquad(clubId) {
    try {
      const result = unwrap(
        await gsp("get_squad", {
          club_id: Number(clubId)
        })
      );

      if (Array.isArray(result) && result.length) {
        return result;
      }
    } catch (error) {
      console.warn("GSP elenco:", error);
    }

    const data = await getJSON(
      API +
      "/datacentre/players/detailed?club_id=" +
      encodeURIComponent(clubId) +
      "&per_page=1000"
    );

    return data.items || [];
  }

  async function getCurrentTactics(clubId) {
    try {
      const result = unwrap(
        await gsp("get_club_tactics", {
          club_id: Number(clubId)
        })
      );

      if (!result) {
        return {
          available: false,
          reason: "Táticas não encontradas"
        };
      }

      if (result.commitment) {
        return {
          available: false,
          hidden: true,
          reason: "Táticas protegidas por compromisso criptográfico"
        };
      }

      return {
        available: true,
        data: result
      };

    } catch (error) {
      return {
        available: false,
        reason: error.message
      };
    }
  }

  async function getTacticsHistory(clubId) {
    try {
      const bootstrap = unwrap(
        await getJSON(API + "/v1/bootstrap")
      );

      const seasonId = bootstrap.seasonId;

      if (!seasonId) {
        return [];
      }

      const schedule = unwrap(
        await gsp("get_club_schedule", {
          club_id: Number(clubId),
          season_id: Number(seasonId)
        })
      );

      if (!Array.isArray(schedule)) {
        return [];
      }

      const fixtures = schedule
        .map(item => item.fixture_id ?? item.fixtureId)
        .filter(Boolean)
        .slice(-10);

      const history = [];

      for (const fixtureId of fixtures) {
        try {
          const data = await getJSON(
            API +
            "/datacentre/fixture_history/tactics/" +
            encodeURIComponent(fixtureId)
          );

          history.push({
            fixtureId,
            data
          });

        } catch (error) {
          console.warn(
            "Histórico indisponível:",
            fixtureId
          );
        }
      }

      return history;

    } catch (error) {
      console.warn("Histórico tático:", error);
      return [];
    }
  }

  async function analyzeClub(clubId) {
    const [players, tactics, history] =
      await Promise.all([
        getSquad(clubId),
        getCurrentTactics(clubId),
        getTacticsHistory(clubId)
      ]);

    return {
      clubId: String(clubId),
      squad: players,
      statistics: getPlayerStats(players),
      currentTactics: tactics,
      tacticsHistory: history,
      updatedAt: new Date().toISOString()
    };
  }

  global.SoccerverseClubData = {
    analyzeClub,
    getSquad,
    getCurrentTactics,
    getTacticsHistory
  };

})(window);
