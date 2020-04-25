const util          = require( "util" );
let fs              = require( "fs" );
const { JSDOM }     = require( "jsdom" );
let xml2js          = require( "xml2js" );

const isDebugEnable = true;
const targetElement = "make-everything-ok-button";

// Promisify some functions
fs.readFile = util.promisify( fs.readFile );
fs.writeFile = util.promisify( fs.writeFile );
xml2js.parseString = util.promisify( xml2js.parseString );

const log = ( line ) => {
    if( isDebugEnable )
        console.log( line );
};

// If we make this compare function better, we can improve the accuracy of the search
const compareElements = ( element1, element2 ) => {

    let coincidences = 0;

    for( let attrName in element1 ){
        if( element2[ attrName ] !== undefined && element2[ attrName ].toString().trim() === element1[ attrName ].toString().trim() )
            coincidences++;
    }

    if( coincidences )
        log( `element1: ${JSON.stringify(element1)} element2: ${JSON.stringify(element2)} coincidences: ${coincidences}`);
    
    return coincidences;

};

// Go through the entire XML file recursively, making comparison of each element with the target element. 
// We will keep the one which have more coincidences with the criteria
const analizeElement2 = ( targetElement, elementName, elementValue, result, partialResult ) => {

    if( typeof elementValue == "string" || typeof elementValue == "number"  || typeof elementValue == "boolean"  ){
        
        //log( "Found an string " );
        // NOTHING ELSE TO DO, THIS IS NOT AN ELEMENT
                
    } else if( elementValue instanceof Array ){
        
        //log( "Found an array " );
        // If we found an array, wi will loop over the entire one, looking for objects to compare
        for( var elementNum in elementValue )
            analizeElement2( targetElement, elementName, elementValue[ elementNum ], result, partialResult + "[" + elementNum + "]" );
        
    } else if( elementValue instanceof Object ){
        
        //console.log( "Found an object" );
        // If we found an object, we will compare its attributes with the target. 
        // We will keep the one which have more score as the search result

        let coincidences = compareElements( targetElement, elementValue );
        let { coincidences : maxCoincidences = 0 } = { result };

        if( maxCoincidences < coincidences ){
            result.coincidences   = coincidences;
            result.path           = partialResult;
        }
        
        // Then, we will continue looping over the rest of the elements of this object
        for( var subElementName in elementValue )
            analizeElement2( targetElement, subElementName, elementValue[ subElementName ], result, ( elementName !== undefined ? partialResult + "." + subElementName : subElementName ) );
               
    } else {
           
        //console.log( "Unknown type" );
        // NOTHING TO DO HERE

    }
                
};

// Check files input
// Read files input
// Parse origin file and look for the attributes of the element to look for
// Once you find it, keep them. If you dont, just show null
// Parse the other one 
// Loop over the entire file to compare recursively
// If we found a match, show it. If we didnt, show a null.
const findSpecificElement = async ( elementId, originFilePath, toCompareFilePath ) => {

    log( `elementId: ${elementId} originFilePath: ${originFilePath} toCompareFilePath: ${toCompareFilePath}` );

    if( ! fs.existsSync( originFilePath ) || ! fs.existsSync( toCompareFilePath ) ){
        log( `Path found: ${null}` );
        return 0;
    }

    const originFile    = await fs.readFile( originFilePath );
    const toCompareFile = await fs.readFile( toCompareFilePath );

    //log( `originFile: ${originFile}` );
    //log( `toCompareFile: ${toCompareFile}` );

    try{
        
        const originFileDOM = new JSDOM(originFile);
        const button = originFileDOM.window.document.getElementById( elementId );
        if( ! button ){
            log( `Path found: ${null}` );
            return 0;
        }

        log( `Successfully found element. Element Text: ${button.textContent.trim()}` );

        const array = Array.prototype.slice.apply(button.attributes);
        array.push( { name: "_", value: button.textContent.trim() } );

        let valuesToCompare = array.reduce( ( valuesToCompare, { name, value } ) => { 
            valuesToCompare[ name ] = value;
            return valuesToCompare;
        }, {});

        
        log( `Attributes String: ${array.map(attr => `${attr.name} = ${attr.value}`).join(", ")}}` );
        log( `Attributes JSON: ${JSON.stringify( valuesToCompare )}` );

        // Parse the toCompare file from XML string to JSON
        const toCompareFileJSON = await xml2js.parseString( toCompareFile );

        let result = { coincidences: 0 };
        // Loop over the JSON making comparisons with every element
        analizeElement2( valuesToCompare, undefined, toCompareFileJSON, result, "" );

        let { path = null } = result;
        log( `Path found: ${path}` );
        if( path )
            await fs.writeFile( `results/${new Date().getTime()}.log`, JSON.stringify( result ) );

    } catch( error ){
        log( error );
    }

};

// Start the search
let [ originFilePath, toCompareFilePath, targetElementFromCmd ] = process.argv.slice(2);
findSpecificElement( targetElementFromCmd || targetElement, originFilePath, toCompareFilePath );