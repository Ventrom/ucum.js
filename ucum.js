parser = require('./generated/ucum-parser.js');
equivalents = require('./generated/equivalents.json');
helpers = require('./lib/helpers.js');

module.exports = {
  parse: parse,
  canonicalize: canonicalize,
  convert: convert,
  print: print
};

function parse(value, units){

  if (arguments.length === 1 || units === undefined){
    units = value;
    value = 1
  }

  if (units.match(/^\//)){
    units = '1'+units;
  }

  if (units === '') units = '1';

  var ret = parser.parse(units);
  ret.value *= value;
  return ret;
}

function nonBaseUnit(u){
  return equivalents[u] !== undefined;
}

function remainingNonBaseUnits(value) {
  return Object.keys(value.units).filter(nonBaseUnit)
}

function canonicalize(value, units){

  value = parse(value, units);

  var remaining = remainingNonBaseUnits(value);

  while (remaining.length) {
    if (remaining.length === 0) {
      return false;
    }

    remaining.forEach(function(u){
      var sub = parse(equivalents[u].ucum);
      sub.value *= equivalents[u].value;
      sub = helpers.topower(sub, value.units[u]);
      value = helpers.multiply(value, [['.', sub]]);
      delete value.units[u];
    });

    remaining = remainingNonBaseUnits(value);
  }

  // we should remove any prefix metadata that exists at this point
  // because it represents residual artifacts of the above process
  if(value.metadata){
    Object.keys(value.metadata).forEach(function(u){
      if(value.metadata[u]){
        if(value.metadata[u].prefix) {
          delete value.metadata[u].prefix;
        }

        // if it's not in the final array of units we should delete this metadata as well
        if(Object.keys(value.units).indexOf(u) == -1){
          delete value.metadata[u];
        }
      }
    });
  }

  return value;
}

function conformant(a, b){
  var ret = true;
  Object.keys(a.units)
  .concat(Object.keys(b.units))
  .forEach(function(k){
    if (a.units[k] !== b.units[k]) {
      ret = false;
    }
  });
  
  return ret;
}

function convert(fromValue, fromUnits, toUnits){
 fromc = canonicalize(fromValue, fromUnits);
 toc = canonicalize(toUnits);

 if (!conformant(fromc, toc)){
   throw "Non-conformant units; can't convert from " + fromUnits + " to " + toUnits ;
 }

 return fromc.value / toc.value;

}

function print(value, units, includeValue){
  var obj;

  if(typeof value === 'object'){
    // treat it like a UCUM parse output
    obj = value;
  }
  else{
    // parse it first
    obj = parse(value, units);
  }

  var units = Object.keys(obj.units);
  var metadata = obj.metadata;
  var numUnits = units.length;
  var printableUnits = "";
  units.forEach(function(unit, index){
    var exponent = obj.units[unit];
    var printable = metadata[unit].printSymbols[0];

    if(exponent !== 1){
      printableUnits += printable;
      printableUnits += "<sup>";
      printableUnits += exponent;
      printableUnits += "</sup>";
    }
    else{
      printableUnits += printable;
    }

    if((numUnits > 1) && (index != (numUnits - 1))){
      printableUnits += "*";
    }
  });

  if(includeValue){
    printableUnits = obj.value + " " + printableUnits;
  }

  return printableUnits;
}