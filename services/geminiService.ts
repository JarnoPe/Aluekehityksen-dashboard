import { GoogleGenAI } from '@google/genai';
import { YearlyData, Municipality } from '../types';

export const analyzePopulationTrend = async (
  popData: YearlyData[],
  empData: YearlyData[],
  unempData: YearlyData[],
  busData: YearlyData[],
  selectedMunicipalities: Municipality[]
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "Tekoälyanalyysi ei ole saatavilla: API-avain puuttuu.";
  }

  if (selectedMunicipalities.length === 0 || popData.length === 0) {
    return "Valitse vähintään yksi kunta nähdäksesi analyysin.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const firstYear = popData[0].year;
  const lastYear = popData[popData.length - 1].year;
  
  const getLastValid = (arr: YearlyData[], muni: Municipality) => {
     for(let i = arr.length - 1; i >= 0; i--) {
         if(arr[i][muni] != null) return arr[i][muni];
     }
     return null;
  };
  
  const summaryData = selectedMunicipalities.map(muni => {
    return {
      kunta: muni,
      vaki_muutos_alku_loppu: (getLastValid(popData, muni) || 0) - (popData[0][muni] || 0),
      tyollisyysaste_viimeisin: getLastValid(empData, muni),
      yritykset_viimeisin: getLastValid(busData, muni),
    };
  });

  const prompt = `
Olet data-analyytikko. Tässä on tiivistelmä aidoista Tilastokeskuksen toteumaluvuista Keski-Pohjanmaan (Kaustisen seutu) kuntien osalta. Data kattaa vuodet ${firstYear}-${lastYear}.
Valitut kunnat tarkasteluun: ${selectedMunicipalities.join(', ')}.

Koostedata (sisältää väestömuutoksen tarkastelujaksolla ${firstYear}-${lastYear}, viimeisimmän tunnetun työllisyysasteen ja yritysten lukumäärän):
${JSON.stringify(summaryData)}

Kirjoita lyhyt, ammattimainen ja ytimekäs analyysi (maksimissaan 3-4 lausetta) valittujen kuntien nykytilanteesta ja elinvoimasta.
Yhdistä analyysissä väestönkehitys, työllisyystilanne sekä alueen yrittäjyys/yrityskanta.
Vastaa selkeällä suomen kielellä. Älä käytä markdown-muotoiluja kuten lihavointia.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.2,
      }
    });

    return response.text || "Analyysin luominen epäonnistui.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Virhe haettaessa tekoälyanalyysiä. Yritä myöhemmin uudelleen.";
  }
};