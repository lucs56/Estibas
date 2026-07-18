import type { EvaluatedStack, VeAllocation } from "./types";

const canonical=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
export function stockGroupKey(productCode:string,lot:string,date:string|null){return [canonical(productCode),canonical(lot),date??""].join("|");}

/** Applies FEFO to the already prioritized stock and stops exactly at demand. */
export function allocateFefo(stacks: EvaluatedStack[], requestedBottles: number): VeAllocation[] {
  let remaining=Math.max(0,requestedBottles);
  const allocations:VeAllocation[]=[];
  const groups=new Map<string,EvaluatedStack[]>();
  stacks.forEach(stack=>{const key=stockGroupKey(stack.productCode,stack.lot,stack.elaborationDate);groups.set(key,[...(groups.get(key)??[]),stack]);});
  for(const members of groups.values()){
    if(remaining<=0)break;
    const groupAvailableBottles=members.reduce((total,stack)=>total+stack.availableQuantity,0);
    for(const stack of members){
      if(remaining<=0)break;
      const usedBottles=Math.min(stack.availableQuantity,remaining);
      if(usedBottles<=0)continue;
      allocations.push({stackId:stack.id,lot:stack.lot,cut:stack.cut,pallet:stack.pallet,barcode:stack.barcode,productCode:stack.productCode,product:stack.product,availableBottles:stack.availableQuantity,groupAvailableBottles,usedBottles,fillingDate:stack.elaborationDate??stack.fractionationDate??""});
      remaining-=usedBottles;
    }
  }
  return allocations;
}

export function groupAllocationsByLot(allocations: VeAllocation[]) {
  const groups=new Map<string,VeAllocation[]>();
  allocations.forEach(item=>{const key=stockGroupKey(item.productCode,item.lot||"SIN LOTE",item.fillingDate);groups.set(key,[...(groups.get(key)??[]),item]);});
  return [...groups.values()].map(items=>({lot:items[0]?.lot||"SIN LOTE",items,productCode:items[0]?.productCode??"",product:items[0]?.product??"",cut:[...new Set(items.map(i=>i.cut).filter(Boolean))].join(" / "),fillingDate:items[0]?.fillingDate??"",availableBottles:Math.max(...items.map(i=>i.groupAvailableBottles||i.availableBottles)),usedBottles:items.reduce((n,i)=>n+i.usedBottles,0)}));
}
