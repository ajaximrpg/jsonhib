/* vim: set expandtab tabstop=3 shiftwidth=3 softtabstop=3: */

/**
* Tests jsonhib.
*
* LICENSE:
* Copyright (c) 2013, Daniel Howard
* All rights reserved.
* 
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met:
* 
* 1. Redistributions of source code must retain the above copyright notice,
* this list of conditions and the following disclaimer.
* 
* 2. Redistributions in binary form must reproduce the above copyright notice,
* this list of conditions and the following disclaimer in the documentation
* and/or other materials provided with the distribution.
* 
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
* AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
* IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
* ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
* LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
* CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
* SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
* INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
* CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
* ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
* POSSIBILITY OF SUCH DAMAGE.
*
* @author Daniel Howard <jsonhib@svexpertise.com>
* @copyright 2013 Daniel Howard
* @license http://opensource.org/licenses/BSD-2-Clause
*/

// jsonhib Class
var jsonhib = require('./jsonhib.js');
var mysql = require('mysql');

// define constants
var SQL_HOST = 'localhost';
var SQL_USER = 'root';
var SQL_PASS = '';
var SQL_DB = 'mydb';

// connect to database
var $link = mysql.createConnection({host: SQL_HOST, user: SQL_USER, password: SQL_PASS});
if ($link) {
   $link.connect();
   $link.query('USE '+SQL_DB, function(err) {
      if (!err) {
         $link.query('SET NAMES \'utf8\'', function() {
            test();
         });
      } else {
         console.log('could not select database');
         return;
      }
   });
} else {
   console.log('could not connect to database');
   return;
}

function test() {
// create a jsonhib object
var jh = new jsonhib({
   'link_identifier': $link,
   'sort_column': 'n', // array index column name
   'json_column': 'json' // freeform JSON column name
});

// jh will work with any of these schemas (i.e. `n` and `json` columns present/missing):
//   CREATE TABLE `mytable` ( `name` text, `age` int ) ; // OK
//   CREATE TABLE `mytable` ( `n` int, `name` text, `age` int ) ; // Better
//   CREATE TABLE `mytable` ( `name` text, `age` int, `json` text ) ; // Even better
//   CREATE TABLE `mytable` ( `n` int, `name` text, `age` int, `json` text ) ; // Best

// test various operations which work to various degrees depending on the schema
jh.insertRow('mytable', '', -1, '{"name": "John", "age": 32, "state": "NY", "zipcode": "91112"}', function() {
jh.insertRow('mytable', '', -1, '{"name": "Bill", "age": 33, "state": "CA"}', function() {
jh.insertRow('mytable', '', 0, '{"name": "Dan", "age": 30, "nickname": "Danny"}', function() {
jh.insertRow('mytable', '', 1, '{"name": "James", "age": 31, "nickname": "Jimmy"}', function() {
jh.updateRow('mytable', '', 2, '{"age": 44}', function() {
jh.updateRow('mytable', '', '{"age": 32}', '{"age": 44}', function() {
jh.deleteRow('mytable', '', 0, function() {
jh.deleteRow('mytable', '', '{"age": 30}', function() {
jh.moveRow('mytable', '', 1, 2, function() {
jh.readRows('mytable', '', function(out) {
// pretty print the JSON
console.log(JSON.stringify(JSON.parse(out), null, 2));
$link.end();
});});});});});});});});});});
}
