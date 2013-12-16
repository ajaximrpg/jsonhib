<?php
/* vim: set expandtab tabstop=3 shiftwidth=3 softtabstop=3: */

/**
* Reads, inserts, deletes, updates and moves rows in MySQL database using the
* JSON (JavaScript Object Notation) format.
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

// JSON Class
if (!class_exists('Services_JSON')) {
   include('JSON.php');
}

/**
 * Use a database for JSON.
 *
 * @version 0.0.9
 * @author Daniel Howard
 */
class jsonhib {

   /**
    * Use a database for JSON.
    *
    * Configurations are arrays with keys like "sort_column",
    * "json_column", and "link_identifier" keys.
    *
    * @param $config A configuration.
    *
    * @author Daniel Howard
    */
   function jsonhib($config=array()) {
      $this->config = $config;
      $this->cache = array();
      $this->json = new Services_JSON();
      $this->json->__construct(SERVICES_JSON_LOOSE_TYPE);
   }

   /**
    * Get JSON table rows from the database.
    *
    * If there is no sort column, the rows are in arbitrary
    * order.
    *
    * @param $table String A database table.
    * @param $clause String A WHERE clause.
    * @return A string containing a JSON array of objects.
    *
    * @author Daniel Howard
    */
   function readRows($table, $clause='') {
      $config = $this->config;

      // cache the table description
      $this->readDesc($table); $desc = $this->cache[$table]['desc_a'];
      $sort_field = isset($this->cache[$table]['sort_column'])? $this->cache[$table]['sort_column']: '';
      $json_field = isset($this->cache[$table]['json_column'])? $this->cache[$table]['json_column']: '';
      $sort_clause = ($sort_field != '')? 'ORDER BY `'.$sort_field.'` ASC': '';

      // read the table
      $objs = array();
      $q = 'SELECT * FROM `'.$table.'` '.$clause.' '.$sort_clause.';';
      $qr = $this->mysql_query($q);
      while ($row = mysql_fetch_assoc($qr)) {
         $obj = array();
         // add the SQL data first
         foreach ($row as $key => $value) {
            if ($key == 'class') {
               $key = 'clazz';
            }
            if ($key == $json_field) {
               // add non-SQL JSON data later
            } elseif ($key == $config['sort_column']) {
               // sort column isn't user data
            } elseif ($value === null) {
               $obj[$key] = null;
            } elseif (is_numeric($value) && (strval(intval($value)) == $value) && is_bool($desc[$key])) {
               $obj[$key] = (intval($value) === 1);
            } elseif (is_numeric($value) && (strval(intval($value)) == $value) && is_int($desc[$key])) {
               $obj[$key] = intval($value);
            } elseif (is_numeric($value) && is_float($desc[$key])) {
               $obj[$key] = floatval($value);
            } else {
               $val = $this->json->decode($value);
               $obj[$key] = is_array($val)? $val: $value;
            }
         }
         // add non-SQL JSON data
         if ($json_field != '') {
            foreach ($this->json->decode($row[$json_field]) as $key => $value) {
               $obj[$key] = $value;
            }
         }
         $objs[] = $obj;
      }

      return $this->json->encode($objs);
   }

   /**
    * Get a JSON table description from the database.
    *
    * It does not return "sort" and "json" columns, if any.
    *
    * @param $table String A database table.
    * @return A string containing a JSON object with columns and default values.
    *
    * @author Daniel Howard
    */
   function readDesc($table) {
      $config = $this->config;

      $desc = array();
      if (isset($this->cache[$table]) && isset($this->cache[$table]['desc'])) {
         $desc = $this->cache[$table]['desc'];
      } else {
         // read the table description
         $sort_column = '';
         $json_column = '';
         $q = 'DESCRIBE `'.$table.'`;';
         $qr_describe = $this->mysql_query($q);
         while ($rowdesc = mysql_fetch_assoc($qr_describe)) {
            $field = $rowdesc['Field'];
            if ($field === $config['sort_column']) {
               $sort_column = $field;
            } elseif ($field === $config['json_column']) {
               $json_column = $field;
            } elseif (strpos($rowdesc['Type'], 'tinyint(1)') !== false) {
               $desc[$field] = false;
            } elseif (strpos($rowdesc['Type'], 'int') !== false) {
               $desc[$field] = 0;
            } elseif (strpos($rowdesc['Type'], 'float') !== false) {
               $desc[$field] = floatval(0);
            } elseif (strpos($rowdesc['Type'], 'double') !== false) {
               $desc[$field] = floatval(0);
            } else {
               $desc[$field] = '';
            }
         }
         // cache the description
         if (!isset($this->cache[$table])) {
            $this->cache[$table] = array();
         }
         $this->cache[$table]['desc_a'] = $desc;
         $desc = $this->json->encode($desc);
         $this->cache[$table]['desc'] = $desc;
         if ($sort_column != '') {
            $this->cache[$table]['sort_column'] = $sort_column;
         }
         if ($json_column != '') {
            $this->cache[$table]['json_column'] = $json_column;
         }
      }

      return $desc;
   }

   /**
    * Insert a row of JSON into a database table.
    *
    * If there is no sort column, it inserts the row, anyway.
    *
    * @param $table String A database table.
    * @param $clause String A WHERE clause.
    * @param $n int The place to insert the row before; -1 means the end.
    * @param $json mixed A JSON string (string) or JSON array (array).
    *
    * @author Daniel Howard
    */
   function insertRow($table, $clause, $n, $json) {
      $config = $this->config;

      if (is_string($json)) {
         $json = $this->json->decode($json);
      }

      // cache the table description
      $this->readDesc($table); $desc = $this->cache[$table]['desc_a'];
      $sort_field = isset($this->cache[$table]['sort_column'])? $this->cache[$table]['sort_column']: '';
      $json_field = isset($this->cache[$table]['json_column'])? $this->cache[$table]['json_column']: '';
      $sort_clause = ($sort_field != '')? 'ORDER BY `'.$sort_field.'` DESC': '';

      // overwrite default values with user values
      foreach ($desc as $col => $value) {
         if (array_key_exists($col, $json)) {
            $compat = false;
            if (gettype($desc[$col]) === gettype($json[$col])) {
               $compat = true;
            }
            if (is_float($desc[$col]) && is_int($json[$col])) {
               $compat = true;
            }
            if (is_string($desc[$col])) {
               $compat = true;
            }
            if ($compat) {
               $desc[$col] = $json[$col];
               unset($json[$col]);
            }
         }
      }
      // update the positions
      $qa = array();
      if ($sort_field != '') {
         $q = 'SELECT '.$sort_field.' FROM `'.$table.'` '.$clause.' '.$sort_clause.';';
         $qr_reorder = $this->mysql_query($q);
         while ($row = mysql_fetch_assoc($qr_reorder)) {
            $n = ($n == -1)? $row[$sort_field] + 1: $n;
            if ($n > $row[$sort_field]) {
               break;
            }
            $set_clause = $sort_field.'='.(intval($row[$sort_field])+1);
            $n_clause = ($clause == '')? 'WHERE ': 'AND ';
            $n_clause .= $sort_field.'='.(intval($row[$sort_field]));
            $q = 'UPDATE `'.$table.'` SET '.$set_clause.' '.$clause.' '.$n_clause.';';
            $qa[] = $q;
         }
         if ($n == -1) {
            $n = 0;
         }
         $desc[$sort_field] = $n;
      }
      // put freeform values into 'json' field
      if ($json_field != '') {
         $desc[$json_field] = $json;
      }
      // make the fields and VALUES clauses
      $set_clause = '';
      foreach ($desc as $col => $value) {
         if ($set_clause != '') {
            $set_clause .= ', ';
         }
         $val = is_array($value)? $this->json->encode($value): $value;
         $val = is_bool($val)? ($val? '1': '0'): $val;
         $val = is_null($val)? 'NULL': '\''.$this->mysql_real_escape_string($val).'\'';
         $set_clause .= $this->mysql_real_escape_string($col).'='.$val;
      }
      $q = 'INSERT INTO `'.$table.'` SET '.$set_clause.';';
      $qa[] = $q;
      foreach ($qa as $q) {
         $this->mysql_query($q);
      }
   }

   /**
    * Delete a row of JSON from a database table.
    *
    * If there is no sort column, it deletes the first row.
    *
    * @param $table String A database table.
    * @param $clause String A WHERE clause.
    * @param $n mixed The row to delete (int) or JSON data to select the row (string).
    *
    * @author Daniel Howard
    */
   function deleteRow($table, $clause, $n) {
      $config = $this->config;

      // cache the table description
      $this->readDesc($table); $desc = $this->cache[$table]['desc_a'];
      $sort_field = isset($this->cache[$table]['sort_column'])? $this->cache[$table]['sort_column']: '';
      $json_field = isset($this->cache[$table]['json_column'])? $this->cache[$table]['json_column']: '';

      // identify the row
      if (($sort_field != '') && (is_int($n))) {
         $sort_clause = (($clause == '')? 'WHERE ': 'AND ').$sort_field.'='.$n;
      } else {
         $sort_clause = '';
         foreach ($this->json->decode($n) as $col => $value) {
            $sort_clause .= (($sort_clause == '') && ($clause == ''))? 'WHERE ': ' AND ';
            $sort_clause .= $col.'=\''.$value.'\'';
         }
         $field = ($sort_field != '')? $sort_field: '*';
         $q = 'SELECT '.$field.' FROM `'.$table.'` '.$clause.' '.$sort_clause.';';
         $qr = $this->mysql_query($q);
         if (mysql_num_rows($qr) == 1) {
            if ($sort_field != '') {
               $row = mysql_fetch_assoc($qr);
               $n = $row[$sort_field];
            }
         } else {
            return;
         }
      }

      $q = 'DELETE FROM `'.$table.'` '.$clause.' '.$sort_clause.';';
      $qa = array($q);
      // update the positions
      if ($sort_field != '') {
         $q = 'SELECT '.$sort_field.' FROM `'.$table.'` '.$clause.' ORDER BY `'.$sort_field.'` ASC;';
         $qr_reorder = $this->mysql_query($q);
         while ($row = mysql_fetch_assoc($qr_reorder)) {
            if ($row[$sort_field] <= $n) {
               continue;
            }
            $set_clause = $sort_field.'='.(intval($row[$sort_field])-1);
            $n_clause = ($clause == '')? 'WHERE ': 'AND ';
            $n_clause .= $sort_field.'='.(intval($row[$sort_field]));
            $q = 'UPDATE `'.$table.'` SET '.$set_clause.' '.$clause.' '.$n_clause.';';
            $qa[] = $q;
         }
      }
      foreach ($qa as $q) {
         $this->mysql_query($q);
      }
   }

   /**
    * Update a row of JSON in a database table.
    *
    * If there is no sort column, it updates the first row.
    *
    * @param $table String A database table.
    * @param $clause String A WHERE clause.
    * @param $n mixed The row to update (int) or JSON data to select the row (string).
    * @param $json mixed A JSON string (string) or JSON array (array).
    *
    * @author Daniel Howard
    */
   function updateRow($table, $clause, $n, $json) {
      $config = $this->config;

      if (is_string($json)) {
         $json = $this->json->decode($json);
      }

      // cache the table description
      $this->readDesc($table); $desc = $this->cache[$table]['desc_a'];
      $sort_field = isset($this->cache[$table]['sort_column'])? $this->cache[$table]['sort_column']: '';
      $json_field = isset($this->cache[$table]['json_column'])? $this->cache[$table]['json_column']: '';

      // identify the row
      if (($sort_field != '') && (is_int($n))) {
         $sort_clause = (($clause == '')? 'WHERE ': 'AND ').$sort_field.'='.$n;
      } else {
         $sort_clause = '';
         foreach ($this->json->decode($n) as $col => $value) {
            $sort_clause .= (($sort_clause == '') && ($clause == ''))? 'WHERE ': ' AND ';
            $sort_clause .= $col.'=\''.$value.'\'';
         }
         $q = 'SELECT * FROM `'.$table.'` '.$clause.' '.$sort_clause.';';
         $qr = $this->mysql_query($q);
         if (mysql_num_rows($qr) == 1) {
            if ($sort_field != '') {
               $row = mysql_fetch_assoc($qr);
               $n = $row[$sort_field];
            }
         } else {
            return;
         }
      }

      // get the freeform JSON data
      $json_data = array();
      if ($json_field != '') {
         $q = 'SELECT '.$json_field.' FROM `'.$table.'` '.$clause.' '.$sort_clause.';';
         $qr_getjson = $this->mysql_query($q);
         if ($qr_getjson && ($row = mysql_fetch_assoc($qr_getjson))) {
            $json_data = $this->json->decode($row[$json_field]);
         }
      }
      // make the SET clause
      $set_clause = '';
      foreach ($json as $col => $value) {
         $compat = false;
         if (array_key_exists($col, $desc)) {
            if (gettype($desc[$col]) === gettype($json[$col])) {
               $compat = true;
            }
            if (is_float($desc[$col]) && is_int($json[$col])) {
               $compat = true;
            }
            if (is_string($desc[$col])) {
               $compat = true;
            }
         }
         if ($compat) {
            // update the SQL data
            if ($set_clause != '') {
               $set_clause .= ', ';
            }
            $val = is_array($value)? $this->json->encode($value): $value;
            $val = is_bool($val)? ($val? '1': '0'): $val;
            $val = is_null($val)? 'NULL': '\''.$this->mysql_real_escape_string($val).'\'';
            $set_clause .= $this->mysql_real_escape_string($col).'='.$val;
            // delete it from the freeform JSON data
            if (array_key_exists($col, $json_data)) {
               unset($json_data[$col]);
            }
         } else {
            // add it to the freeform JSON data
            $json_data[$col] = $value;
         }
      }
      // update the freeform JSON data
      if ($json_field != '') {
         if ($set_clause != '') {
            $set_clause .= ', ';
         }
         $set_clause .= $json_field.'=\''.$this->mysql_real_escape_string($this->json->encode($json_data)).'\'';
      }
      $q = 'UPDATE `'.$table.'` SET '.$set_clause.' '.$clause.' '.$sort_clause.';';
      $qr_update = $this->mysql_query($q);
   }

   /**
    * Reorder a row of JSON in a database table.
    *
    * If there is no sort column, it does nothing.
    *
    * @param $table String A database table.
    * @param $clause String A WHERE clause.
    * @param $m int The row to move.
    * @param $n int The row to move to.
    *
    * @author Daniel Howard
    */
   function moveRow($table, $clause, $m, $n) {
      $config = $this->config;

      if ($m == $n) {
         return;
      }

      // cache the table description
      $this->readDesc($table); $desc = $this->cache[$table]['desc_a'];
      $sort_field = isset($this->cache[$table]['sort_column'])? $this->cache[$table]['sort_column']: '';
      $sort_clause = ($sort_field != '')? 'ORDER BY `'.$sort_field.'`': '';

      // update the positions
      if ($sort_field != '') {
         $q = 'SELECT '.$sort_field.' FROM `'.$table.'` '.$clause.' '.$sort_clause.' DESC;';
         $qr_end = $this->mysql_query($q);
         if ($row = mysql_fetch_assoc($qr_end)) {
            // save the row at the end
            $temp = intval($row[$sort_field]) + 1;
            $where_clause = $clause.(($clause != '')? ' AND': 'WHERE').' '.$sort_field.'='.$m;
            $q = 'UPDATE `'.$table.'` SET '.$sort_field.'='.$temp.' '.$where_clause.';';
            $this->mysql_query($q);
            // update positions of other rows as needed
            $qa = array();
            $sort_clause .= ' '.(($m < $n)? 'ASC': 'DESC');
            $q = 'SELECT '.$sort_field.' FROM `'.$table.'` '.$clause.' '.$sort_clause.';';
            $qr_reorder = $this->mysql_query($q);
            while ($row = mysql_fetch_assoc($qr_reorder)) {
               if ($m < $n) {
                  if (($row[$sort_field] < $m)) {
                     continue;
                  } elseif ($row[$sort_field] > $n) {
                     break;
                  }
               } else {
                  if (($row[$sort_field] > $m)) {
                     continue;
                  } elseif ($row[$sort_field] < $n) {
                     break;
                  }
               }
               $set_clause = $sort_field.'='.(intval($row[$sort_field])+(($m < $n)? -1: 1));
               $n_clause = (($clause == '')? 'WHERE ': 'AND ').$sort_field.'='.(intval($row[$sort_field]));
               $qa[] = 'UPDATE `'.$table.'` SET '.$set_clause.' '.$clause.' '.$n_clause.';';
            }
            // move the row to the new position
            $set_clause = $sort_field.'='.$n;
            $n_clause = (($clause == '')? 'WHERE ': 'AND ').$sort_field.'='.$temp;
            $qa[] = 'UPDATE `'.$table.'` SET '.$set_clause.' '.$clause.' '.$n_clause.';';
            foreach ($qa as $q) {
               $this->mysql_query($q);
            }
         }
      }
   }

   /**
    * Flexible mysql_query() function.
    * 
    * @param $query String The query to execute.
    * @return The mysql_query() return value.
    *
    * @author Daniel Howard
    */
   function mysql_query($query) {
      if (isset($this->config['link_identifier'])) {
         return mysql_query($query, $this->config['link_identifier']);
      }
      return mysql_query($query);
   }

   /**
    * Flexible mysql_real_escape_string() function.
    * 
    * @param $unescaped_string String The string.
    * @return The mysql_real_escape_string() return value.
    *
    * @author Daniel Howard
    */
   function mysql_real_escape_string($unescaped_string) {
      if (isset($this->config['link_identifier'])) {
         return mysql_real_escape_string($unescaped_string, $this->config['link_identifier']);
      }
      return mysql_real_escape_string($unescaped_string);
   }
}
?>
