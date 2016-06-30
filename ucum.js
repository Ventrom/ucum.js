parser = require('./generated/ucum-parser.js');
equivalents = require('./generated/equivalents.json');
helpers = require('./lib/helpers.js');

module.exports = {
  parse: parse,
  canonicalize: canonicalize,
  convert: convert,
  format: format
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

// format returns a printable represetnation of the value
// the resulting units are a single-line html rendering of the resultant units
// can be invoked in the following supported ways, by example:
// 1. ucum.format('[in_i]') -> 'in'
// 2. ucum.format('[in_i]', true) -> '1 in'
// 3. ucum.format(3, '[in_i]', true) -> '3 in'
// 4. var x = ucum.parse(3, '[in_i]'); ucum.format(x) -> 'in'
// 5. var x = ucum.parse(3, '[in_i]'); ucum.format(x, true) -> '3 in'
function format(value, units, includeValue){
  var obj;

  if(typeof value === 'string'){
    includeValue = units;
    units = value;
    value = 1;
  }

  if(typeof value === 'object'){
    // treat it like a UCUM parse output
    obj = value;
    includeValue = units; // you would never provide units in this case, but you might provide includeValue
  }
  else{
    // parse it first
    obj = parse(value, units);
  }

  var units = Object.keys(obj.units);
  var metadata = obj.metadata;
  var numUnits = units.length;
  var numeratorUnits = [];
  var denominatorUnits = [];
  var printableUnits = "";
  
  units.forEach(function(unit, index){
    var exponent = obj.units[unit];
    var absExponent = Math.abs(exponent);
    var printable = metadata[unit].printSymbols[0];
    var prefix = metadata[unit].prefix ? metadata[unit].prefix.printSymbols[0] : "";
    pUnit = prefix + printable;
    if(absExponent !== 1){      
      pUnit += "<sup>";
      pUnit += Math.abs(exponent);
      pUnit += "</sup>";
    }
    
    if(exponent > 0){
      numeratorUnits.push(pUnit);
    }
    else{
      denominatorUnits.push(pUnit);
    }
  });


  if(numeratorUnits.length == 0){
    printableUnits = "1";
  }
  else if(numeratorUnits.length == 1){
    printableUnits = numeratorUnits[0];
  }
  else if(numeratorUnits.length > 1){
    //printableUnits = "(";
    numeratorUnits.forEach(function(unit, index){
      printableUnits += unit;
      if(index != (numeratorUnits.length - 1)){
        printableUnits += "*";
      }
    });
    //printableUnits += ")";
  }
  
  if(denominatorUnits.length == 1){
    printableUnits += "/";
    printableUnits += denominatorUnits[0];
  } 
  else if(denominatorUnits.length > 1){
    printableUnits += "/";
    //printableUnits += "(";
    denominatorUnits.forEach(function(unit, index){
      printableUnits += unit;
      if(index != (numeratorUnits.length - 1)){
        printableUnits += "/";
      }
    });
    //printableUnits += ")";
  }

  if(includeValue){
    printableUnits = obj.value + " " + printableUnits;
  }

  return printableUnits;
}