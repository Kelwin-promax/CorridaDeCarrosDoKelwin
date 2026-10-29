'use strict';
// Gera as miniaturas dos carros da garagem (public/thumbs/*.webp).
// Uso: node tools/make-thumbs.js  e abra http://localhost:3001/__thumbs/ no navegador.
// A página desenha cada carro com o mesmo código do jogo e envia a imagem para cá.
const fs = require('fs');
const path = require('path');
const express = require('express');

const PUBLIC = path.join(__dirname, '..', 'public');
const OUT = path.join(PUBLIC, 'thumbs');
fs.mkdirSync(OUT, { recursive: true });

const app = express();
app.get('/__thumbs/', (req, res) => res.sendFile(path.join(__dirname, 'thumbs.html')));
app.post('/__thumbs/save/:name', express.raw({ type: '*/*', limit: '5mb' }), (req, res) => {
  const name = path.basename(req.params.name);
  if (!/^[\w.-]+\.webp$/.test(name)) return res.status(400).end();
  fs.writeFileSync(path.join(OUT, name), req.body);
  console.log('salvo', name, req.body.length, 'bytes');
  res.end('ok');
});
app.use(express.static(PUBLIC));
app.listen(3001, () => console.log('Abra http://localhost:3001/__thumbs/'));
