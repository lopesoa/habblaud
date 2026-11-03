import { defaultDashboard, type Company } from '../../../../shared/dashboard';
import { BUILDING_H, COL_W, TILE } from '../constants';
import type { ExteriorLayout } from '../layout/exterior';

export const ENTERPRISE_THEMES = defaultDashboard().companies;
export function enterpriseTheme(id?: string): Company | undefined { return ENTERPRISE_THEMES.find(c => c.id === id); }
export function enterpriseGround(company: Company): string {
  return ({ port: '#637f87', agro: '#7b8e48', construction: '#a28d69', food: '#abb4a3', warehouse: '#b1a184', architecture: '#8baba5', office: '#899da9' })[company.sector];
}

/** Local scenery only: buildings, crops and vehicles are decoration, never activity or agents. */
export function paintEnterpriseExterior(ctx: CanvasRenderingContext2D, exterior: ExteriorLayout, company: Company, cols: number): void {
  const width = cols * COL_W * TILE, height = BUILDING_H * TILE;
  const b = exterior.bounds, left = b.x*TILE, top = b.y*TILE, right = (b.x+b.w)*TILE, bottom=(b.y+b.h)*TILE;
  const accent = company.color, ground=enterpriseGround(company), sector=company.sector;
  const box=(x:number,y:number,w:number,h:number,color:string)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const line=(x:number,y:number,dx:number,dy:number,color:string,width=2)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.stroke();};
  const container=(x:number,y:number,color:string)=>{
    box(x+4,y+40,96,8,'#263c3c44');box(x,y,96,43,color);box(x,y,96,4,'#ffffff24');
    for(let i=8;i<92;i+=10)box(x+i,y+5,2,34,'#102e3455');box(x,y+39,96,4,'#183a4855');
    box(x+62,y+13,22,10,'#e8ecd0');box(x+66,y+17,13,2,'#455662');
  };
  const silo=(x:number,y:number)=>{
    box(x+5,y+92,58,7,'#293c3f44');box(x,y+18,60,76,'#b9c8c4');
    for(let i=0;i<6;i++)box(x,y+24+i*12,60,2,'#819b99');
    box(x+7,y+10,46,8,'#d7e3da');box(x+18,y+3,24,7,'#e7ead9');
    box(x+5,y+20,6,71,'#dce7dc');box(x+48,y+20,8,71,'#849b97');
    box(x+26,y+80,11,15,accent);line(x+63,y+20,0,70,'#526c70');
    for(let i=0;i<8;i++)box(x+59,y+23+i*8,9,2,'#526c70');
  };
  const crane=(x:number,y:number)=>{
    box(x+29,y+6,8,116,accent);box(x,y,140,8,accent);box(x+24,y-7,19,11,accent);
    line(x+33,y+8,94,0,'#223b4c',2);line(x+33,y-6,94,11,'#dbdcc1',2);
    for(let i=0;i<7;i++){line(x+30,y+12+i*15,8,12,'#324c51');line(x+38,y+12+i*15,-8,12,'#324c51');}
    line(x+124,y+8,0,57,'#2d4553');box(x+117,y+65,15,5,'#324552');
    box(x+16,y+117,35,6,'#40535c');
  };
  const truck=(x:number,y:number,color=accent)=>{
    box(x+3,y+36,114,6,'#233a3c44');box(x,y,83,29,color);box(x+4,y+4,75,3,'#ffffff30');
    for(let i=11;i<80;i+=10)box(x+i,y+9,1,17,'#20394b33');
    box(x+83,y+10,29,24,'#e9e8d6');box(x+88,y+12,16,11,'#527c8e');box(x+104,y+20,10,14,'#e9e8d6');
    box(x+6,y+29,103,5,'#374d53');
    for(const dx of [13,62,91]){box(x+dx,y+29,14,12,'#273842');box(x+dx+4,y+32,6,6,'#99a5a1');}
  };
  const office=(x:number,y:number,w:number,h:number)=>{
    box(x+8,y+h,w,10,'#253e4244');box(x,y,w,h,'#314d65');box(x,y,w,7,accent);box(x+w-8,y+7,8,h-7,'#243e53');
    for(let row=14;row<h-12;row+=17)for(let col=8;col<w-12;col+=17){box(x+col,y+row,11,11,(row+col)%3?'#8dbbbd':'#dce2bf');box(x+col,y+row,2,11,'#ffffff25');}
    box(x+w/2-12,y+h-23,24,23,'#bcd8d0');line(x+w/2,y+h-23,0,23,'#617f89');
  };
  const factory=(x:number,y:number)=>{
    box(x+5,y+95,222,8,'#324a4144');box(x,y+18,220,78,'#e7e6cf');box(x-7,y+10,234,13,accent);
    box(x+154,y-24,20,34,'#9dada5');box(x+157,y-27,14,5,'#6e827c');
    for(let i=0;i<4;i++){box(x+14+i*48,y+36,36,40,'#729591');box(x+17+i*48,y+39,30,3,'#b6d9d0');}
    box(x+17,y+77,183,18,'#89958b');for(let i=0;i<8;i++){box(x+23+i*22,y+79,14,14,i%2?'#d4bf87':'#e7dec0');box(x+27+i*22,y+83,6,3,accent);}
  };
  ctx.save();ctx.imageSmoothingEnabled=false;
  box(left,top,right-left,-top,ground);box(left,0,-left,height,ground);box(width,0,right-width,height,ground);
  const yard=height+11*TILE;box(left,yard,right-left,bottom-yard,ground);
  // Fine terrain texture: deterministic and cached once per selected theme.
  for(let y=top;y<0;y+=16)for(let x=left;x<right;x+=24)box(x+((y/16)%2?8:0),y,8,1,'#ffffff10');
  const north=-156;
  if(sector==='port'){
    box(left,top,right-left,-top-26,'#266d85');
    for(let y=top+12;y<-32;y+=16)for(let x=left+10;x<right;x+=54)box(x+(y%3)*4,y,28,2,'#70bcc04a');
    box(left,-48,right-left,34,'#a9b3a0');box(left,-48,right-left,5,'#d0d0af');
    const shipX=width/2-174;
    box(shipX+12,north+29,318,44,'#1d4058');box(shipX+31,north+70,278,9,'#173346');
    box(shipX+42,north+17,256,14,'#cdd7c6');box(shipX+257,north-18,36,36,'#d8e4d6');box(shipX+261,north-12,27,8,'#548693');
    for(let i=0;i<3;i++)container(shipX+42+i*67,north-10,i%2?'#c89d5a':accent);
    crane(-115,-166);crane(width-85,-166);
    if(company.id!=='cimbessul'){silo(30,-143);silo(98,-143);}
    else {container(12,-104,accent);container(114,-104,'#d0aa58');}
    for(let x=20;x<width-80;x+=230){container(x,yard+25,accent);if(company.id==='export')truck(x+110,yard+30,'#bfd444');}
  }else if(sector==='agro'){
    for(const [start,end] of [[top,-22],[yard+8,bottom-20]]){
      for(let y=start+8;y<end;y+=21){box(left+12,y,right-left-24,12,'#6b623c');for(let x=left+18;x<right-14;x+=19){box(x,y-5,2,12,'#a5bd64');box(x-3,y,8,3,'#668c3f');if(x>width*.7)box(x-2,y-7,7,6,'#f1e4bd');else if(x<width*.25)box(x-1,y-7,4,7,'#e0c258');}}
    }
    // Tractor with cabin, exhaust and oversized rear wheel.
    box(width/2-44,-102,72,28,accent);box(width/2-19,-137,34,38,'#4d7c57');box(width/2-14,-132,24,23,'#9dc4b4');box(width/2-46,-124,4,23,'#374e41');
    for(const [x,y,z] of [[width/2-32,-84,25],[width/2+24,-81,18]]){box(x,y,z,z,'#283e35');box(x+6,y+6,z-12,z-12,'#bdc28b');}
    silo(width-160,-137);silo(width-87,-137);truck(18,yard+28);
  }else if(sector==='warehouse'){
    for(let x=24;x<width-62;x+=79)silo(x,-139);
    box(20,-49,width-40,9,'#6b8078');for(let x=50;x<width-40;x+=62)box(x,-40,5,23,'#68776c');
    for(let x=20;x<width-90;x+=185)truck(x,yard+30,'#8b9b69');
    box(-150,-60,100,40,'#d7c79f');for(let i=0;i<6;i++)box(-145+i*15,-56,10,31,'#b49a66');
  }else if(sector==='food'){
    for(let x=10;x<width-150;x+=270)factory(x,-143);
    for(let x=30;x<width-90;x+=190)truck(x,yard+24,'#d3ac59');
    for(let x=-180;x<-40;x+=32){box(x,-80,25,47,'#d4bd8d');box(x+4,-75,17,3,'#f1dfb9');box(x+7,-60,11,9,accent);}
  }else if(sector==='construction'){
    crane(25,-165);crane(width-175,-165);
    for(let i=0;i<5;i++){box(width/2-85+i*34,-63-i*7,30,24,'#c6a57e');box(width/2-85+i*34,-63-i*7,30,3,'#eed7a9');}
    box(width/2-65,-138,81,27,accent);box(width/2-49,-173,39,38,'#4f6b6a');box(width/2-44,-169,28,23,'#a0c2b6');
    box(width/2-73,-109,107,17,'#374941');for(let i=0;i<6;i++)box(width/2-65+i*16,-106,10,10,'#81917d');
    line(width/2+11,-137,63,-35,accent,10);line(width/2+74,-172,24,70,accent,9);box(width/2+82,-110,27,15,'#4b5946');
    box(left,yard+32,right-left,62,'#5c6668');for(let x=left+15;x<right;x+=50)box(x,yard+62,26,3,'#e3cc8a');
    for(let x=20;x<width;x+=170){box(x,yard+17,11,17,'#e2a24c');box(x-3,yard+33,17,4,'#f5e3b3');}truck(35,yard+45);
  }else if(sector==='architecture'){
    for(let x=15;x<width-70;x+=135){office(x,-155,90,113);box(x-5,-43,100,9,'#d6ddd1');}
    // Plan table: blueprint grid and a miniature building.
    box(-179,-97,121,67,'#314d68');for(let i=0;i<6;i++)box(-173+i*18,-91,1,54,'#7eafba');for(let i=0;i<4;i++)box(-173,-91+i*15,109,1,'#7eafba');
    box(-143,-84,42,34,'#cbdad0');box(-138,-79,32,24,accent);
  }else{
    for(let x=10;x<width-70;x+=151)office(x,-169,111,132);
    for(let x=20;x<width-30;x+=100){box(x,yard+20,72,52,'#aab6b3');box(x+1,yard+20,2,52,'#d8dfd0');box(x+67,yard+20,2,52,'#d8dfd0');box(x+21,yard+27,28,39,accent);box(x+24,yard+34,22,9,'#567b89');}
  }
  // Branded entrance strip, kept outside every room and walking route.
  box(0,-18,width,14,'#1c353e');box(0,-18,width,3,accent);
  ctx.fillStyle='#e6edd9';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText(company.name.toUpperCase(),width/2,-7);
  ctx.restore();
}
