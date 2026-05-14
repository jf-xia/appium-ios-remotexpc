#!/usr/bin/env node

const response = await fetch('http://127.0.0.1:4726/demo/run');
const body = await response.text();
console.log(body);