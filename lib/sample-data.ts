import { lotDateFromCode, weekStartIso } from "./expiry";
import type { AppCatalogs, AppSettings, AppUser, AuditEntry, LotDate, ProductionOrder, StackRecord, VeRequest } from "./types";

type Row = [string,string,string,string,string,number,string,string,string,string,string,string,string,boolean?];
const rows: Row[] = [
  ["218260616755058","2","J01","1243E","TILIA MALBEC 1×750 SC",308,"2026-06-16","L1 - 26042","3894","STOCK ESTIBA","Argentina","Malbec","2025"],
  ["218260707783118","11","J02","3340E","ALAMOS MALBEC RESERVE 1×750",316,"2026-07-07","L2 - 26072","3921","STOCK ESTIBA","Argentina","Malbec","2025"],
  ["218260708784066","8","J01","332EVO","ALAMOS SELECCIÓN PINOT NOIR",282,"2026-07-08","L1 - 26086","3928","STOCK ESTIBA","Argentina","Pinot Noir","2025"],
  ["218260625768373","1","J02","365E","ESTIBA I MALBEC 1×750",24,"2026-06-25","L2 - 26042","3914","MERCADO INTERNO","Argentina","Malbec","2025",true],
  ["018260429706591","2","J01","389E","ALAMOS TORRONTÉS SC 1×750",672,"2026-04-29","L1 - 26119","3929","MERCADO INTERNO","Argentina","Torrontés","2025"],
  ["218260603741146","4","J01","1154E","TILIA TORRONTÉS SC 1×750",55,"2026-06-03","L1 - 26119","3929","STOCK ESTIBA","Argentina","Torrontés","2025"],
  ["218260714790968","3","J01","303-EKOR","ALAMOS CABERNET SAUVIGNON KOREA",620,"2026-07-14","L1 - 26114","3907","LOTTE LIQUOR","Corea del Sur","Cabernet Sauvignon","2025"],
  ["018260513719773","2","J01","1502E","HIGH NOTE MALBEC 1×750",672,"2026-05-13","L1 - 26133","3894","STOCK ESTIBA","Estados Unidos","Malbec","2025"],
  ["218260515723770","1","J01","330E","ALAMOS WOTM MALBEC 1×750",57,"2026-05-15","L1 - 26124","3894","STOCK ESTIBA","Argentina","Malbec","2025"],
  ["218260602740643","5","J01","1575EUSA","TILIA ORGÁNICO CHARDONNAY",607,"2026-06-02","L1 - 26131","3854","TRIALTO WINE GROUP LTD","Canadá","Chardonnay","2025"],
  ["218260709786828","7","J01","128EUSA","ANIMAL CAB SAUV ORGÁNICO",71,"2026-07-09","L1 - 26124","3778","VINEYARD BRANDS","Estados Unidos","Cabernet Sauvignon","2025"],
  ["218260714790299","2","J01","397E","ALAMOS CABERNET SAUVIGNON",30,"2026-07-14","L1 - 26147","3907","STOCK ESTIBA","Argentina","Cabernet Sauvignon","2025"],
  ["218260709787277","1","J01","121EUSA","ANIMAL MALBEC ORGÁNICO",102,"2026-07-09","L1 - 26160","3938","VINEYARD BRANDS","Estados Unidos","Malbec","2025"],
  ["218260713789130","3","J01","1573EUSA","TILIA ORGÁNICO MALBEC",348,"2026-07-13","L1 - 26177","3938","TRIALTO WINE GROUP LTD","Canadá","Malbec","2025"],
  ["218260714791148","5","J01","1325E","PADRILLOS MALBEC 1×750",315,"2026-07-14","L1 - 26183","3939","MERCADO INTERNO","Argentina","Malbec","2025"],
  ["218260714791317","2","J01","302E","ALAMOS MALBEC 1×750",132,"2026-07-14","L1 - 26188","3939","MERCADO INTERNO","Argentina","Malbec","2025"],
  ["218260714791399","1","J01","305E","ALAMOS MALBEC SC 1×750",570,"2026-07-14","L1 - 26184","3939","MERCADO INTERNO","Argentina","Malbec","2025"],
  ["218260709785858","2","J01","1154E","TILIA TORRONTÉS SC 1×750",486,"2026-07-09","L1 - 25251","3846","STOCK ESTIBA","Argentina","Torrontés","2025"],
  ["027260714791999","1","V02","4810-E","EL ENEMIGO BONARDA 1×750",86,"2026-07-14","L2 - 26195","2356","MERCADO INTERNO","Argentina","Bonarda","2023"],
];
export const sampleStacks: StackRecord[] = rows.map(([barcode,pallet,line,productCode,product,qty,date,lot,cut,client,country,variety,harvest,used]) => ({
  id: barcode, barcode, pallet, line, productCode, product, originalQuantity: qty, availableQuantity: used ? 0 : qty,
  fractionationDate: date, location: "E18", sourceStatus: barcode.startsWith("218") ? "Almacenado" : "Producido a Almacena",
  lot, cut, client, country, variety, harvest, used: Boolean(used), extraData: { fuente: "ESTIBAS(1)(1).xlsx", simulacion: true },
}));
export const sampleLots: LotDate[] = Array.from({length:11},(_,offset)=>2016+offset).flatMap(year=>Array.from({length:366},(_,i)=>lotDateFromCode(`${String(year).slice(-2)}${String(i+1).padStart(3,"0")}`)).filter((v):v is LotDate=>Boolean(v))).map(lot=>({...lot,sourceName:"Lotes_2016_2026.xlsx"}));

type ProgramRow=[string,number,string,string,string,string,string,string,string,string,string,string,number,number,number,string,string];
const programRows:ProgramRow[]=[
  ["Sem 20-07 al 24-07",83,"","E00000048115","301-25-501","ALAMOS","CHARDONNAY","2025","0.750","Tapón","IMP. DE LA MANCHA S.A. DE CV","MEXICO",77,12,924,"","24/7/2026"],
  ["Sem 20-07 al 24-07",84,"","E00000048135","2077-25-705","PASARISA","MALBEC","2025","0.750","Tapón","Enotria Winecellars Ltd.","UNITED KINGDOM",410,6,2460,"","4/8/2026"],
  ["Sem 20-07 al 24-07",85,"","E00000048135","1330-25-705","TILIA","CABERNET SAUVIGNON","2025","0.750","Screw","Enotria Winecellars Ltd.","UNITED KINGDOM",140,6,840,"","4/8/2026"],
  ["Sem 20-07 al 24-07",86,"","E00000048135","1347-25-705","TILIA","MALBEC","2025","0.750","Screw","Enotria Winecellars Ltd.","UNITED KINGDOM",420,6,2520,"","4/8/2026"],
  ["Sem 20-07 al 24-07",87,"","E00000048149","1154-25-407","TILIA","TORRONTES","2025","0.750","Screw","WINEBOW INC.","UNITED STATES OF AMERICA",70,12,840,"","7/8/2026"],
  ["Sem 20-07 al 24-07",88,"","E00000048149","1576-25-407","TILIA ORGANICO","CABERNET SAUVIGNON","2025","0.750","Screw","WINEBOW INC.","UNITED STATES OF AMERICA",70,12,840,"","7/8/2026"],
  ["Sem 20-07 al 24-07",89,"Sem 13/07","E00000048088","1573-25-407","TILIA ORGANICO","MALBEC","2025","0.750","Screw","WINEBOW INC.","UNITED STATES OF AMERICA",189,12,2268,"","22/7/2026"],
  ["Sem 20-07 al 24-07",90,"","STOCK","2382-24","DV CATENA LA RIOJA","MALBEC","2024","0.750","Tapón","MERCADO INTERNO","ARGENTINA",1000,6,6000,"",""],
  ["Sem 20-07 al 24-07",91,"","E00000010930","4813-23-354","EL ENEMIGO ESPERANZA","BONARDA","2023","0.750","Tapón","JEAN ARNAUD WIJNCOM BV","HOLANDA",40,6,240,"","5/8/2026"],
  ["Sem 20-07 al 24-07",92,"","E00000010933","4812-23-759","EL ENEMIGO PARAISOS","BONARDA","2023","0.750","Tapón","BARRERE & CAPDEVIELLE","FRANCIA",200,6,1200,"","6/8/2026"],
  ["Sem 20-07 al 24-07",93,"","E00000010922","4811-23-885","EL ENEMIGO BARRANCO","BONARDA","2023","0.750","Tapón","MISTRAL IMPORTADORA LTDA","BRASIL",200,6,1200,"","29/7/2026"],
  ["Sem 20-07 al 24-07",94,"","STOCK","3340-24","ALAMOS RESERVE","MALBEC","2024","0.750","Tapón","MERCADO INTERNO","ARGENTINA",500,6,3000,"",""],
  ["TENTATIVO Sem 27-07 al 31-07",44,"","E00000048152","302-25-119","ALAMOS","MALBEC","2025","0.750","Tapón","JIMKA INTERNATIONAL INC","COLOMBIA",210,12,2520,"","3/8/2026"],
  ["TENTATIVO Sem 27-07 al 31-07",45,"","E00000048152","306-25-119","ALAMOS","BONARDA","2025","0.750","Tapón","JIMKA INTERNATIONAL INC","COLOMBIA",35,12,420,"","3/8/2026"],
  ["TENTATIVO Sem 27-07 al 31-07",46,"","E00000048152","314-25-119","ALAMOS","SYRAH","2025","0.750","Tapón","JIMKA INTERNATIONAL INC","COLOMBIA",70,12,840,"","3/8/2026"],
  ["TENTATIVO Sem 27-07 al 31-07",47,"","E00000048154","314-25-784","ALAMOS","SYRAH","2025","0.750","Tapón","UAB «JUNERA»","LATVIA",70,12,840,"","7/8/2026"],
  ["TENTATIVO Sem 27-07 al 31-07",48,"","E00000048152","300-25-119","ALAMOS","CABERNET SAUVIGNON","2025","0.750","Tapón","JIMKA INTERNATIONAL INC","COLOMBIA",35,12,420,"","3/8/2026"],
  ["TENTATIVO Sem 27-07 al 31-07",49,"","E00000048154","301-25-784","ALAMOS","CHARDONNAY","2025","0.750","Tapón","UAB «JUNERA»","LATVIA",70,12,840,"","7/8/2026"],
  ["TENTATIVO Sem 27-07 al 31-07",50,"","E00000048145","1575-25-407","TILIA ORGANICO","CHARDONNAY","2025","0.750","Screw","WINEBOW INC.","UNITED STATES OF AMERICA",70,12,840,"","7/8/2026"],
  ["TENTATIVO Sem 27-07 al 31-07",51,"","E00000048149","1573-25-407","TILIA ORGANICO","MALBEC","2025","0.750","Screw","WINEBOW INC.","UNITED STATES OF AMERICA",560,12,6720,"","7/8/2026"],
  ["TENTATIVO Sem 27-07 al 31-07",52,"","E00000048190","388-25-461","ALAMOS","VIOGNIER","2025","0.750","Screw","INTERVINOS NV","BELGIUM",100,6,600,"","5/8/2026"],
  ["TENTATIVO Sem 27-07 al 31-07",53,"","E00000010939","1397-26-262","PADRILLOS","TRIFECTA","2026","0.750","Screw","TANTA ROBA DI TESEO GERI","ITALIA",100,6,600,"","10/8/2026"],
];
export const sampleOrders:ProductionOrder[]=programRows.map(([week,sheetRow,day,pn,internalCode,brand,variety,harvest,capacity,closure,client,country,boxes,unitsPerBox,bottles,observations,frc],index)=>({
  id:`gs-vestir-${index+1}`,week,day,pn,internalCode,brand,variety,harvest,capacity,closure,liters:0,client,country,
  action:"VESTIR",boxes,unitsPerBox,bottles,market:client.trim().toUpperCase().includes("MERCADO INTERNO")?"Mercado interno":"Mercado externo",
  alcohol:"",cut:"",line:"Línea 3",lineNumber:3,sheetRow,observations,frc,possibleDressingDate:weekStartIso(week,2026),
  presentation:`${unitsPerBox} × 750 mL`,status:"PROGRAMADO",source:"simulated",
}));

export const sampleRequests: VeRequest[] = [{ id:"ve-demo-001",number:"VE-2026-0142",createdAt:"2026-07-16T14:32:00.000Z",requestDate:"2026-07-16",fillingDate:"2026-07-13",possibleDressingDate:"Sem 20-07 al 24-07",line:"Línea 3",brand:"ALAMOS",variety:"VIOGNIER",harvest:"2025",cut:"3853",lots:["L1 - 26131"],selectedStackIds:["218260602740643"],totalStockBottles:607,requestedBottles:600,productCode:"388-25-461",presentation:"6 × 750 mL",market:"Mercado externo",requestedBoxes:100,unitsPerBox:6,client:"INTERVINOS NV",pn:"E00000048190",destination:"BELGIUM",closure:"Screw",alcohol:"",responsible:"",observed:false,status:"generated" }];
export const sampleUsers: AppUser[] = [
  { id:"u1",name:"Administrador",email:"admin@bodega.local",username:"admin",credentialHash:"03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4",role:"Administrador",active:true },
];
export const defaultCatalogs: AppCatalogs = {
  Clientes:["MERCADO INTERNO","TRIALTO WINE GROUP LTD","VINEYARD BRANDS","LOTTE LIQUOR"],
  Productos:["ALAMOS","TILIA","ANIMAL","NICASIA VINEYARDS"],
  Variedades:["Malbec","Chardonnay","Cabernet Sauvignon","Torrontés","Pinot Noir"],
  Países:["Argentina","Canadá","Estados Unidos","Corea del Sur"],
  Líneas:["J01","J02","J05","V01","V02"],
};
export const sampleAudit: AuditEntry[] = [
  { id:"a1",timestamp:"2026-07-18T13:41:00.000Z",actor:"Marisel",action:"Importación",entity:"Estibas",detail:"602 registros; 30 columnas reconocidas automáticamente" },
  { id:"a2",timestamp:"2026-07-18T13:43:00.000Z",actor:"Marisel",action:"Importación",entity:"Lotes",detail:"365 lotes del año 2026 vinculados" },
  { id:"a3",timestamp:"2026-07-18T13:45:00.000Z",actor:"Sistema",action:"Sincronización",entity:"Google Sheets",detail:"3 pestañas semanales detectadas" },
];
export const defaultSettings: AppSettings = { expirationDays:90,urgentDays:15,warningDays:30,spreadsheetId:"1XL44rx3sNKpxowAQzY1iSjy7s8lYOsPTMngD6xeBDPQ",spreadsheetGid:"1258079893",googleMode:"connected" };
