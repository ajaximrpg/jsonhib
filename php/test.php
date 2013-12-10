<?php
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
include('jsonhib.php');

// define constants
define('SQL_HOST', 'localhost');
define('SQL_USER', 'root');
define('SQL_PASS', '');
define('SQL_DB', 'mydb');

// connect to database
$link = @mysql_connect(SQL_HOST, SQL_USER, SQL_PASS);
if ($link) {
   $select = mysql_select_db(SQL_DB);
   if ($select) {
      mysql_query('SET NAMES \'utf8\'');
   } else {
      die('could not select database');
   }
} else {
   die('could not connect to database');
   unset($link);
}

// create a jsonhib object
$jh = new jsonhib(array(
   'sort_column'=>'n', // array index column name
   'json_column'=>'json', // freeform JSON column name
));

// $jh will work with any of these schemas (i.e. `n` and `json` columns present/missing):
//   CREATE TABLE `mytable` ( `name` text, `age` int ) ; // OK
//   CREATE TABLE `mytable` ( `n` int, `name` text, `age` int ) ; // Better
//   CREATE TABLE `mytable` ( `name` text, `age` int, `json` text ) ; // Even better
//   CREATE TABLE `mytable` ( `n` int, `name` text, `age` int, `json` text ) ; // Best

// test various operations which work to various degrees depending on the schema
$jh->insertRow('mytable', '', -1, '{"name": "John", "age": 32, "state": "NY", "zipcode": "91112"}');
$jh->insertRow('mytable', '', -1, '{"name": "Bill", "age": 33, "state": "CA"}');
$jh->insertRow('mytable', '', 0, '{"name": "Dan", "age": 30, "nickname": "Danny"}');
$jh->insertRow('mytable', '', 1, '{"name": "James", "age": 31, "nickname": "Jimmy"}');
$jh->updateRow('mytable', '', 2, '{"age": 44}');
$jh->updateRow('mytable', '', '{"age": 32}', '{"age": 44}');
$jh->deleteRow('mytable', '', 0);
$jh->deleteRow('mytable', '', '{"age": 30}');
$jh->moveRow('mytable', '', 1, 2);
// read the database rows
$out = $jh->readRows('mytable');
// pretty print the JSON
$json = new Services_JSON();
print $json->encode($json->decode($out), true);
?>
