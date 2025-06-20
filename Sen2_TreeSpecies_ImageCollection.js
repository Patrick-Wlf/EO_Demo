#Script to download Sen2 image collection for exactly the tree species occurence data
#use TreeSatAI for coordinates
# ImageCollection are downloaded for every species individually

// Import data
var points = ee.FeatureCollection("projects/ee-pwolf/assets/TreeSatAI"); // -> Use the table uploaded by you
var unique_species = points.aggregate_array('l3_species').distinct();

// Get the first 10 features of the points collection
//var first10Points = points.limit(10);
// Print the first 10 elements to the console
//print('First 10 points:', first10Points);

// Region of Interest (ROI) of Germany
var Boundary = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017");
var boundary = Boundary.select("country_co");
var roi_germany = boundary.filter(ee.Filter.eq('country_co','GM'));

// Sentinel-2 spectral bands
var commonBands = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B9', 'B11', 'B12', 
                  'MSK_CLDPRB'];
                  
/***Calculate Vegetation Index***/   // -> Exploration of various features is encouraged
var addNDVI = function(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
};

var addEVI = function(image) {
  var evi = image.expression(
    '2.5 * ((NIR - red) / (NIR + 6 * red - 7.5 * blue + 1))',
    {
      'red': image.select('B4'),
      'NIR': image.select('B8'),
      'blue': image.select('B2')
    }
  ).rename('EVI');
  return image.addBands(evi);
};

var addEVI2 = function(image) {
  var evi2 = image.expression(
    '2.5 * ((NIR - red) / (NIR + 2.4 * red + 1))',
    {
      'red': image.select('B4'),
      'NIR': image.select('B8')
    }
  ).rename('EVI2');
  return image.addBands(evi2);
};

var addSAVI = function(image) {
  var savi = image.expression(
    '((NIR - red) / (NIR + red + L)) * (1 + L)',
    {
      'red': image.select('B4'),
      'NIR': image.select('B8'),
      'L': 0.5
    }
  ).rename('SAVI');
  return image.addBands(savi);
};

var addNDWI = function(image) {
  var ndwi = image.normalizedDifference(['B8', 'B11']).rename('NDWI');
  return image.addBands(ndwi);
};
                  

// Remove clouds
function maskS2clouds(image) {
  // Use the cloud probability band (MSK_CLDPRB) to mask clouds
  var cloudProb = image.select('MSK_CLDPRB');
  
  // Mask cloudy pixels where cloud probability is greater than a threshold (e.g., 20%)
  var mask = cloudProb.lt(20);
  
  return image.updateMask(mask).divide(10000);
}

                   
// Function to access Sentinel-2 data
function processMonthlyData(startDate, endDate, cloudThreshold) {
    return ee.ImageCollection('COPERNICUS/S2_SR')
        .filterBounds(roi_germany)                   // ROI
        .filterDate(startDate, endDate)              // date range 
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudThreshold)) // filter clounds
        .map(function(image) {
            return image.clip(roi_germany)
                        .select(commonBands);        // band selection
        })
        .map(maskS2clouds)                           // mask clouds
        .map(addNDVI)                                // add NDVI
        .map(addEVI)                                 // add EVI
        .map(addEVI2)                                // add EVI2
        .map(addSAVI)                                // add SAVI
        .map(addNDWI)                                // add NDWI
        .median();                                   // calculate median value for monthly composite
}

/***Process monthly data***/   // 
var s2_Mar = processMonthlyData('2022-03-01', '2022-03-31', 20);   //20% cloud cover
var s2_Apr = processMonthlyData('2022-04-01', '2022-04-30', 20);
var s2_May = processMonthlyData('2022-05-01', '2022-05-31', 20);
var s2_Jun = processMonthlyData('2022-06-01', '2022-06-30', 20);
var s2_Jul = processMonthlyData('2022-07-01', '2022-07-31', 20);
var s2_Aug = processMonthlyData('2022-08-01', '2022-08-31', 20);
var s2_Sep = processMonthlyData('2022-09-01', '2022-09-30', 20);
var s2_Oct = processMonthlyData('2022-10-01', '2022-10-31', 20);


// Function to upsample Bands to 10m resolution
function upsampleBands(image) {
    // List of bands to upsample
    var bandsToUpsample = ['B5', 'B6', 'B7', 'B8A', 'B11', 'B12'];
    
    // Upsample each band and store the results in a list
    var upsampledBands = bandsToUpsample.map(function(band) {
        var originalBand = image.select(band);
        var upsampledBand = originalBand.reproject({
            crs: image.projection(),  // Keep the same projection
            scale: 10                 // Set new resolution to 10m
        });
        return upsampledBand.rename(band);  // Rename the band to keep original name
    });
    
    // Remove the original bands from the image
    var imageWithoutBands = image.select(image.bandNames().removeAll(bandsToUpsample));
    
    // Add the upsampled bands to the image
    var imageWithUpsampledBands = imageWithoutBands.addBands(ee.Image.cat(upsampledBands));
    
    return imageWithUpsampledBands;
}

// Apply upsampling 
var s2_Mar_upsampled = upsampleBands(s2_Apr);
var s2_Apr_upsampled = upsampleBands(s2_Apr);
var s2_May_upsampled = upsampleBands(s2_May);
var s2_Jun_upsampled = upsampleBands(s2_Jun);
var s2_Jul_upsampled = upsampleBands(s2_Jul);
var s2_Aug_upsampled = upsampleBands(s2_Aug);
var s2_Sep_upsampled = upsampleBands(s2_Sep);
var s2_Oct_upsampled = upsampleBands(s2_Oct);


var s2 = s2_Mar_upsampled.addBands(s2_Apr_upsampled).addBands(s2_May_upsampled).addBands(s2_Jun_upsampled).addBands(s2_Jul_upsampled).addBands(s2_Aug_upsampled).addBands(s2_Sep_upsampled).addBands(s2_Oct_upsampled);

var Bands = ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12', 'NDVI', 'EVI', 'EVI2', 'SAVI', 'NDWI',
'B2_1', 'B3_1', 'B4_1', 'B5_1', 'B6_1', 'B7_1', 'B8_1', 'B8A_1', 'B11_1', 'B12_1', 'NDVI_1', 'EVI_1', 'EVI2_1', 'SAVI_1', 'NDWI_1',
'B2_2', 'B3_2', 'B4_2', 'B5_2', 'B6_2', 'B7_2', 'B8_2', 'B8A_2', 'B11_2', 'B12_2', 'NDVI_2', 'EVI_2', 'EVI2_2', 'SAVI_2', 'NDWI_2',
'B2_3', 'B3_3', 'B4_3', 'B5_3', 'B6_3', 'B7_3', 'B8_3', 'B8A_3', 'B11_3', 'B12_3', 'NDVI_3', 'EVI_3', 'EVI2_3', 'SAVI_3', 'NDWI_3',
'B2_4', 'B3_4', 'B4_4', 'B5_4', 'B6_4', 'B7_4', 'B8_4', 'B8A_4', 'B11_4', 'B12_4', 'NDVI_4', 'EVI_4', 'EVI2_4', 'SAVI_4', 'NDWI_4',
'B2_5', 'B3_5', 'B4_5', 'B5_5', 'B6_5', 'B7_5', 'B8_5', 'B8A_5', 'B11_5', 'B12_5', 'NDVI_5', 'EVI_5', 'EVI2_5', 'SAVI_5', 'NDWI_5',
'B2_6', 'B3_6', 'B4_6', 'B5_6', 'B6_6', 'B7_6', 'B8_6', 'B8A_6', 'B11_6', 'B12_6', 'NDVI_6', 'EVI_6', 'EVI2_6', 'SAVI_6', 'NDWI_6',
'B2_7', 'B3_7', 'B4_7', 'B5_7', 'B6_7', 'B7_7', 'B8_7', 'B8A_7', 'B11_7', 'B12_7', 'NDVI_7', 'EVI_7', 'EVI2_7', 'SAVI_7', 'NDWI_7']


//we only want April (1), June ( 3 ) and october (7) 
//we only want April (1), June ( 3 ) and october (7) 
//& B3 B4 B6 B8 B11 NDVI -> 6 bands
//var Bands_select = ['B3_3', 'B4_3', 'B6_3', 'B8_3', 'B11_3', 'NDVI_3']
var Bands_select = ['B3_1', 'B4_1','B6_1', 'B8_1', 'B11_1', 'NDVI_1',
                    'B3_3', 'B4_3','B6_3', 'B8_3', 'B11_3', 'NDVI_3',
                    'B3_7', 'B4_7','B6_7', 'B8_7', 'B11_7', 'NDVI_7']                  
                  

var s2_select = s2.select(Bands_select)


var kernel = ee.Kernel.rectangle(1, 1);  // -> Exploration of various patch size is encouraged
var neighborImg = s2_select.neighborhoodToArray(kernel);

// Download data according to Hierarchical Labels
// Hierarchical Labels
var treeHierarchy = {
  'broadleaf': {
    'beech': ['european beech'],
    'oak': ['sessile oak', 'english oak', 'red oak'],
    'long-lived deciduous': ['sycamore maple', 'european ash', 'linden', 'cherry'],
    'short-lived deciduous': ['alder', 'poplar', 'birch']
  },
  'needleleaf': {
    'fir': ['silver fir'],
    'larch': ['european larch', 'japanese larch'],
    'spruce': ['norway spruce'],
    'pine': ['scots pine', 'black pine', 'weymouth pine'],
    'douglas fir': ['douglas fir']
  }
};

// Function to get hierarchical classification of species
function getSpeciesHierarchy(speciesName) {
  var result = {};
  Object.keys(treeHierarchy).forEach(function (level1) {
    var level2Dict = treeHierarchy[level1];
    Object.keys(level2Dict).forEach(function (level2) {
      if (level2Dict[level2].indexOf(speciesName) !== -1) {
        result = { level1: level1, level2: level2 };
      }
    });
  });
  return result;
}

// Iterate through each unique species
unique_species.evaluate(function (speciesList) {
  speciesList.forEach(function (species) {
    // Filter points based on species
    var speciesCollection = points.filterMetadata('l3_species', 'equals', species);
    var safeSpeciesName = species.replace(/ /g, '');

    // Get species hierarchy
    var hierarchyInfo = getSpeciesHierarchy(species);
    var level1 = hierarchyInfo.level1;
    var level2 = hierarchyInfo.level2;

    // Define folder path based on hierarchy
    var folderPath = level1 + '_' + level2 + '_' + species;
    
    // Sample the image (neighborImg) for each species point
    var samples = neighborImg.sampleRegions({
    collection: speciesCollection,  // Use the points from speciesCollection
    scale: 10                      // Specify the scale of 10 meters per pixel
    });

    // Export the table to Google Drive, organized by hierarchical classification
    Export.table.toDrive({
      collection: samples,
      description: safeSpeciesName,
      folder: 'TreeSatAI',
      fileNamePrefix: folderPath,
      fileFormat: 'GeoJSON'
    });
  });
});


