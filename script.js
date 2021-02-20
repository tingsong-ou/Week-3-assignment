//INITIALIZING CANVAS
const size = {w: 1000, h: 300};
const mapSize = {w: 1000, h: 400};
const margin = {top: 0, left: 30, buttom:30, right: 20};
const yearSVG = d3.select('svg.year');
const mapSVG = d3.select('svg.map');

let barScaleX, barScaleY, yearBrush, mapPath;
let filter = {};

yearSVG.attr('width', size.w)
    .attr('height', size.h);

mapSVG.attr('width', mapSize.w)
    .attr('height', mapSize.h);

let yearChart = yearSVG.append('g').classed('graph', true);
const map = mapSVG.append('g').classed('map', true);

//CREATING VISUALIZATION

Promise.all([
    d3.csv('data/netflix_titles.csv'),
    d3.json('data/map/world.geo.json')
]).then(function(d){

    //DATA PROCESSING
    let mapData = d[1];

    let nfxData = d[0].map(d=>{
        let mapped = {};
        mapped.country = d.country;
        mapped.year = +d.releaseYear;
        mapped.type = d.type;
        return mapped;
    });

    let filteredNfxData = nfxData;

    //MAKING DROPDOWN MENU
    let list = [];
    list.push('All');
    for(d of nfxData){
        if(!list.includes(d.type)) list.push(d.type);
    }
    dropDown('genre', list);


    //CREATING BARCHART
    barChart(nfxData);

    //CREATING MAP
    mapPath = drawMap(mapData);
    colorMap(mapPath,nfxData);


    //CREATING BRUSH
    yearBrush = d3.brushX()
    .extent([[margin.left, margin.top], [size.w - margin.right - 5, size.h - margin.buttom]])
    .on('end', function(e){
        if(!e.selection) return;

        let step = barScaleX.step();
        let lowerIndex = Math.floor((e.selection[0]-margin.left) / step);
        let lowerVal = barScaleX.domain()[lowerIndex];

        let upperIndex = Math.floor((e.selection[1]-margin.left) / step);
        let upperVal = barScaleX.domain()[upperIndex];

        filter.extent = [upperVal, lowerVal];
        updateData(filteredNfxData);
    });
    yearChart.call(yearBrush);

    //UPDATING DATA
    d3.select('#genre').on('change', function(){
        let genre = d3.select(this).property('value');
        if(genre != 'All') 
            filteredNfxData = nfxData.filter(d => d.type === genre);
        else 
            filteredNfxData = nfxData;
        barChart(filteredNfxData);
        colorMap(mapPath,filteredNfxData);
        yearChart.call(yearBrush.clear);
        yearChart.call(yearBrush);
    });

});


//----FUNCTIONS-----

//BARCHART FUNCTION
function barChart(data){
    data = d3.group(data, d => d.year);
    data = Array.from(data);

    if(!barScaleX && !barScaleY){
        let years = [];
        for(let d of data) years.push(d[0]);
        years.sort((a, b) => b - a);

        barScaleX = d3.scaleBand()
            .padding(0.2)
            .domain(years)
            .range([margin.left, size.w - margin.right]);

        barScaleY = d3.scaleLinear()
            .domain(d3.extent(data, d => d[1].length))
            .range([size.h - margin.buttom, margin.top]);
        
        //DRAWING AXIS
        let xAxis = yearChart.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${size.h - margin.buttom})`)
            .call(d3.axisBottom().scale(barScaleX))
            .selectAll('text')
            .attr('transform','rotate(45)')
            .attr('x', 16)
            .attr('y', 4);
        
        let yAxis = yearChart.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(d3.axisLeft().scale(barScaleY));
        
    }

    let chart = yearChart.selectAll('rect.bars')
        .data(data, d => d[0]);

    chart.enter()
        .append('rect')
        .attr('class', 'bars')
        .attr('x', d => barScaleX(d[0]))
        .attr('y', (size.h - margin.buttom))
        .attr('width', barScaleX.bandwidth())
        .attr('height', 0)
        .transition()
        .duration(500)
        .attr('y', d => barScaleY(d[1].length))
        .attr('width', barScaleX.bandwidth())
        .attr('height', d => size.h - margin.buttom - barScaleY(d[1].length))
        .attr('class', 'bars');
    
    chart
        .transition()
        .duration(500)
        .attr('x', d => barScaleX(d[0]))
        .attr('y', d => barScaleY(d[1].length))
        .attr('width', barScaleX.bandwidth())
        .attr('height', d => size.h - margin.buttom - barScaleY(d[1].length));
    
    chart.exit()
        .transition()
        .duration(500)
        .attr('y', (size.h - margin.buttom))
        .attr('height', 0);

}


//DROPDOWN MENU FUNCTION
function dropDown(id, list){
    let selections = document.getElementById(id);

    for(i of list){
        let element = document.createElement('option');
        element.textContent = i;
        element.value = i;
        selections.appendChild(element);
    }
}

//DATA UPDATE FUNCTION
function updateData(data){
    let filteredData = data.filter(d => d.year >= filter.extent[0] && d.year <= filter.extent[1]);
    barChart(filteredData);
    colorMap(mapPath,filteredData);
    yearChart.call(yearBrush);
}

//MAP FUNCTION
function drawMap(mapData){

    let projection = d3.geoCahillKeyes()
        .fitExtent([[-50, -50],[mapSize.w - 100, mapSize.h]], mapData);
    
    let graticule = d3.geoGraticule()
        .step([10, 10]);
    
    let outline = d3.geoGraticule()
        .outline();

    let path = d3.geoPath(projection);

    map.append('path')
        .datum(outline)
        .attr('class', 'outline')
        .attr('transform', 'translate(80, 0)')
        .attr('d', path);

    let pathSel = map.selectAll('path')
        .data(mapData.features)
        .enter()
        .append('path')
        .attr('transform', 'translate(80, 0)')
        .attr('id', d => d.properties.brk_name)
        .attr('d', d => path(d));
    
    map.append('path')
        .datum(graticule)
        .attr('transform', 'translate(80, 0)')
        .attr('class', 'graticule')
        .attr('d', path);

    return pathSel;
}

//SHADE MAP FUNCTION
function colorMap(paths, data){
    
    //DATA PROCESSING
    let countries = [];
    let filteredCountries = [];
    let countByCountry = {};
    let values = [];

    for (d of data){
        countries = countries.concat(d.country.split(", "));
    }
    countries.forEach(d => {
        d.replace(',', '');
        if (d && !filteredCountries.includes(d)) filteredCountries.push(d);
    });

    for(let c of filteredCountries){
        countByCountry[c] = 0;
        for(let d of data){
            if(d.country.includes(c)) countByCountry[c]++;
        }
        values.push(countByCountry[c]);
    }

    //CREATING EXTENT
    let extent = d3.extent(values, d => d);
    let median = d3.median(values);

    //SHADING MAP
    let colorScale = d3.scaleLinear()
        .domain([extent[0], median, extent[1]])
        .range([d3.interpolateYlGnBu(0),d3.interpolateYlGnBu(0.5),d3.interpolateYlGnBu(1)]);

    paths.transition()
        .duration(300)
        .style('fill', function(d){
        let name = d.properties.brk_name;
        if (countByCountry[name]) return colorScale(countByCountry[name]);
        else return 'white';
    })
}